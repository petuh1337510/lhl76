import runpy
import unittest
from pathlib import Path

module = runpy.run_path(str(Path(__file__).with_name("cleanup-app-images.py")))
choose = module["choose_images"]

def image(name, repository="ghcr.io/petuh1337510/lhl76"):
    return {"Id": name, "RepoDigests": [repository+"@sha256:"+name]}

class CleanupSelectionTests(unittest.TestCase):
    def test_retains_current_previous_and_all_container_images(self):
        images = [image(name) for name in ["current", "previous", "old", "stopped-container"]] + [image("postgres", "postgres")]
        self.assertEqual(choose(images, "current", "previous", {"current", "postgres", "stopped-container"}), ["old"])

    def test_refuses_missing_or_duplicate_retained_version(self):
        for current, previous in [("current", "missing"), ("current", "current")]:
            with self.assertRaises(RuntimeError):
                choose([image("current")], current, previous, {"current"})

    def test_does_not_delete_unknown_or_shared_repository_images(self):
        other = image("shared")
        other["RepoDigests"].append("example.org/other@sha256:shared")
        tagged = image("tagged")
        tagged["RepoTags"] = ["example.org/other:latest"]
        images = [image("current"), image("previous"), other, tagged, {"Id":"unknown", "RepoDigests": []}]
        self.assertEqual(choose(images, "current", "previous", {"current"}), [])

    def test_refuses_wrong_repository_for_rollback(self):
        with self.assertRaises(RuntimeError):
            choose([image("current"), image("previous", "postgres")], "current", "previous", {"current"})

if __name__ == "__main__":
    unittest.main()
