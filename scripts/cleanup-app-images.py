#!/usr/bin/env python3
"""Remove only unused LHL-76 images, keeping explicit current and rollback IDs."""
import argparse
import json
import os
import subprocess

REPOSITORY = "ghcr.io/petuh1337510/lhl76@sha256:"
COMPOSE = ["docker", "compose", "--env-file", "/opt/lhl76/.env", "-f", "/opt/lhl76/docker-compose.production.yml"]


def run(*args):
    return subprocess.check_output(args, text=True).strip()


def choose_images(images, current, previous, used):
    by_id = {image["Id"]: image for image in images}
    if current == previous or current not in by_id or previous not in by_id:
        raise RuntimeError("Both distinct retained images must exist")
    def owned(image):
        digests = image.get("RepoDigests") or []
        return bool(digests) and all(ref.startswith(REPOSITORY) for ref in digests) and all(tag.startswith("ghcr.io/petuh1337510/lhl76:") for tag in image.get("RepoTags") or [])
    if not owned(by_id[current]) or not owned(by_id[previous]):
        raise RuntimeError("Retained images must belong to the LHL-76 repository")
    return [image["Id"] for image in images
            if owned(image) and image["Id"] not in used | {current, previous}]


def inspect_container(identifier):
    value = json.loads(run("docker", "inspect", identifier))[0]
    return {"Id": value["Id"], "Image": value["Image"], "StartedAt": value["State"]["StartedAt"], "Mounts": value["Mounts"]}


def files_snapshot():
    result = {}
    for root in ["/opt/lhl76/public-files", "/opt/lhl76/backups"]:
        if not os.path.isdir(root):
            raise RuntimeError("Protected directory is missing")
        for directory, _, files in os.walk(root):
            for name in files:
                path = os.path.join(directory, name)
                stat = os.stat(path, follow_symlinks=False)
                result[path] = (stat.st_ino, stat.st_size, stat.st_mtime_ns)
    return result


def available_bytes():
    stat = os.statvfs("/")
    return stat.f_bavail * stat.f_frsize


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--expected-current", required=True)
    parser.add_argument("--previous", required=True)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    current = json.loads(run("docker", "image", "inspect", args.expected_current))[0]["Id"]
    previous = json.loads(run("docker", "image", "inspect", args.previous))[0]["Id"]
    app_id = run(*COMPOSE, "ps", "-q", "app")
    db_id = run(*COMPOSE, "ps", "-q", "db")
    if not app_id or not db_id:
        raise RuntimeError("Both production containers must be running")
    app_before, db_before = inspect_container(app_id), inspect_container(db_id)
    if app_before["Image"] != current:
        raise RuntimeError("Running version differs from expected current image")
    ids = run("docker", "image", "ls", "-aq", "--no-trunc").splitlines()
    images = json.loads(run("docker", "image", "inspect", *sorted(set(ids))))
    print(json.dumps({"inventory": [{"Id": image["Id"], "RepoDigests": image.get("RepoDigests"), "RepoTags": image.get("RepoTags"),
                                    "oci_labels": {key: value for key, value in (image.get("Config", {}).get("Labels") or {}).items() if key.startswith("org.opencontainers.image.")}}
                                   for image in images]}), flush=True)
    container_ids = run("docker", "ps", "-aq").splitlines()
    used = {container["Image"] for container in json.loads(run("docker", "inspect", *container_ids))}
    candidates = choose_images(images, current, previous, used)
    print(json.dumps({"mode": "apply" if args.apply else "preview", "keep_current": current, "keep_previous": previous, "remove": candidates}), flush=True)
    if not args.apply:
        return
    protected_before = files_snapshot()
    free_before = available_bytes()
    for image_id in candidates:
        # Recheck the running release and let Docker refuse any image now in use.
        if inspect_container(app_id) != app_before:
            raise RuntimeError("Application changed during cleanup")
        subprocess.run(["docker", "image", "rm", image_id], check=True)
    assert inspect_container(app_id) == app_before, "Application container changed"
    assert inspect_container(db_id) == db_before, "Database container or mounts changed"
    protected_after = files_snapshot()
    assert all(protected_after.get(path) == stat for path, stat in protected_before.items()), "Protected files changed during cleanup"
    for image_id in [current, previous]:
        run("docker", "image", "inspect", "--format", "{{.Id}}", image_id)
    free_after = available_bytes()
    print(json.dumps({"removed_images": len(candidates), "free_before_bytes": free_before, "free_after_bytes": free_after, "freed_bytes": free_after-free_before,
                      "protected_files_verified": len(protected_before), "containers_unchanged": True}), flush=True)
    print(run("df", "-B1", "--output=source,size,used,avail,pcent,target", "/"))
    print(run("docker", "system", "df"))


if __name__ == "__main__":
    main()
