import type { Vec3 } from '../../../shared/vec3';

/** Reject-only segment/capsule test: distance between two finite segments.
 * Includes tangencies, endpoints, start-inside and zero-length axes/shots. */
export function segmentIntersectsCapsule(start: Vec3, end: Vec3, a: Vec3, b: Vec3, radius: number): boolean {
  const ux=end.x-start.x, uy=end.y-start.y, uz=end.z-start.z;
  if (!Number.isFinite(start.x) || !Number.isFinite(start.y) || !Number.isFinite(start.z)
    || !Number.isFinite(ux) || !Number.isFinite(uy) || !Number.isFinite(uz)) return false;
  if (radius===Infinity) return true; // unsupported skinning must never reject
  const vx=b.x-a.x, vy=b.y-a.y, vz=b.z-a.z;
  const wx=start.x-a.x, wy=start.y-a.y, wz=start.z-a.z;
  const uu=ux*ux+uy*uy+uz*uz, vv=vx*vx+vy*vy+vz*vz;
  const uv=ux*vx+uy*vy+uz*vz, uw=ux*wx+uy*wy+uz*wz, vw=vx*wx+vy*wy+vz*wz;
  let s=0, t=0;
  if (uu===0) t=vv===0 ? 0 : Math.max(0,Math.min(1,vw/vv));
  else if (vv===0) s=Math.max(0,Math.min(1,-uw/uu));
  else {
    const cx=uy*vz-uz*vy,cy=uz*vx-ux*vz,cz=ux*vy-uy*vx;
    const determinant=cx*cx+cy*cy+cz*cz;
    // Ill-conditioned, almost parallel axes may admit extra work, never misses.
    if(determinant>0 && determinant<=1e-14*uu*vv) return true;
    s=determinant>0 ? Math.max(0,Math.min(1,(uv*vw-uw*vv)/determinant)) : 0;
    t=(uv*s+vw)/vv;
    if (t<0) { t=0; s=Math.max(0,Math.min(1,-uw/uu)); }
    else if (t>1) { t=1; s=Math.max(0,Math.min(1,(uv-uw)/uu)); }
  }
  const dx=wx+s*ux-t*vx, dy=wy+s*uy-t*vy, dz=wz+s*uz-t*vz;
  return dx*dx+dy*dy+dz*dz<=(radius+1e-8)**2;
}
