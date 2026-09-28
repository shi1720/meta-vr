import { thumbTip, solveFK, createJointBuffers, finger, jointPos } from '../src/pose.js';
import { CAPTURED_RELAXED_POSITIONS as P } from '../src/skeleton.js';
const f = (v: number[]) => v.map(x => (x*100).toFixed(1).padStart(6)).join(' ');
console.log('captured thumb tip (cm)', f(P[4] as any));
for (const [yaw,pitch,mcp,ip] of [[0,0,0,0],[40,0,0,0],[-40,0,0,0],[0,40,0,0],[0,-20,0,0],[0,0,40,0],[0,0,0,40],[70,40,20,20],[90,50,30,30]]) {
  console.log(`yaw ${yaw} pitch ${pitch} mcp ${mcp} ip ${ip} -> tip`, f(thumbTip({yaw,pitch,mcp,ip}) as any));
}
const b = createJointBuffers();
solveFK({ thumb:{yaw:0,pitch:0,mcp:0,ip:0}, index: finger(0,0), middle: finger(0,0), ring: finger(0,0), pinky: finger(0,0)}, b);
for (const i of [6,9,11,14,16,19,21,24]) console.log('joint',i, f(jointPos(b,i) as any), 'captured', f(P[i] as any));
solveFK({ thumb:{yaw:0,pitch:0,mcp:0,ip:0}, index: finger(85,100), middle: finger(85,100), ring: finger(85,100), pinky: finger(85,100)}, b);
for (const i of [9,14,19,24]) console.log('fist tip',i, f(jointPos(b,i) as any));
