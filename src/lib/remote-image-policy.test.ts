import {describe,it,expect} from 'vitest';
import {remoteImageUrl,publicIpv4} from './remote-image-policy';
describe('remote image boundary',()=>{
 it('only permits HTTPS on known image CDNs',()=>{expect(remoteImageUrl('https://sun9-1.userapi.com/photo.jpg')).not.toBeNull();for(const value of ['http://sun9-1.userapi.com/a','https://userapi.com.evil.test/a','https://127.0.0.1/a','https://sun9-1.userapi.com:8080/a','https://user:password@sun9-1.userapi.com/a'])expect(remoteImageUrl(value)).toBeNull();});
 it('blocks internal, metadata, loopback and reserved IPv4',()=>{for(const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','172.16.0.1','192.168.1.1','100.64.0.1','0.0.0.0','224.0.0.1','198.18.0.1','203.0.113.1'])expect(publicIpv4(ip)).toBe(false);expect(publicIpv4('93.184.216.34')).toBe(true);});
});
