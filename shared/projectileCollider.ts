import type { HitZone } from './player-logic';
import type { Vec3 } from './vec3';

/** Current CPU-skinned surface, in world space. No enclosing damage volume. */
export interface HitSurface {
  positions: Float64Array;
  indices: Uint32Array;
  zones: readonly HitZone[];
  patches?: readonly SurfacePatch[];
}
interface SurfacePatch { min?: Vec3; max?: Vec3; first: number; count: number }
export interface SurfaceHit { point: Vec3; zone: HitZone; t: number }

/** Reject-only slab test; inclusive for grazing and start-inside segments. */
export function segmentIntersectsBounds(start: Vec3, end: Vec3, min: Vec3, max: Vec3): boolean {
  let lo=0, hi=1;
  for (const axis of ['x','y','z'] as const) {
    const d=end[axis]-start[axis];
    if (!Number.isFinite(start[axis]) || !Number.isFinite(d)) return false;
    if (Math.abs(d)<1e-14) {
      if (start[axis]<min[axis] || start[axis]>max[axis]) return false;
    } else {
      const a=(min[axis]-start[axis])/d, b=(max[axis]-start[axis])/d;
      lo=Math.max(lo,Math.min(a,b)); hi=Math.min(hi,Math.max(a,b));
    }
  }
  return lo<=hi;
}

/** Small surface patches only: each AABB fits a <=0.30 m sphere, below the
 * smallest staging enclosing sphere (BREACH 0.331906 m). There is no whole-
 * character broadphase. Patches reject work, never register a damage hit. */
export function indexHitSurface(surface: HitSurface): HitSurface {
  const patches: SurfacePatch[]=[];
  const {positions:p,indices}=surface;
  const append=(first:number,count:number):void=>{
    const min={x:Infinity,y:Infinity,z:Infinity},max={x:-Infinity,y:-Infinity,z:-Infinity};
    for(let i=first;i<first+count;i++) {
      const j=indices[i]*3;
      min.x=Math.min(min.x,p[j]); max.x=Math.max(max.x,p[j]);
      min.y=Math.min(min.y,p[j+1]); max.y=Math.max(max.y,p[j+1]);
      min.z=Math.min(min.z,p[j+2]); max.z=Math.max(max.z,p[j+2]);
    }
    const radius=Math.hypot(max.x-min.x,max.y-min.y,max.z-min.z)/2;
    if(radius>.30 && count>3) {
      const left=Math.floor(count/6)*3;
      append(first,left); append(first+left,count-left);
    } else {
      // A pathological single triangle larger than the cap gets no broadphase.
      patches.push(radius>.30 ? {first,count} : {min,max,first,count});
    }
  };
  for(let first=0;first<indices.length;first+=192) append(first,Math.min(192,indices.length-first));
  return {...surface,patches};
}

/** Asset bone names after GLTFLoader sanitization; model left remains left. */
export function hitZoneForBone(name: string): HitZone {
  if (name === 'Head') return 'head';
  if (/Arm|Shoulder|Palm|Finger|Thumb/.test(name)) return name.endsWith('L') ? 'leftArm' : 'rightArm';
  if (/Leg|Foot|Toe/.test(name)) return name.endsWith('L') ? 'leftLeg' : 'rightLeg';
  return 'body';
}

/** Double-sided segment/triangle intersections. First surface wins, including
 * when the segment starts inside the mesh. No sphere, nearest-part fallback,
 * bullet-radius inflation, or animation envelope participates in damage. */
export function segmentHitSurface(start: Vec3, end: Vec3, surfaces: readonly HitSurface[]): SurfaceHit | null {
  const dx=end.x-start.x, dy=end.y-start.y, dz=end.z-start.z;
  if (![start.x,start.y,start.z,dx,dy,dz].every(Number.isFinite)) return null;
  let nearest: SurfaceHit | null = null;
  for (const {positions:p,indices,zones,patches} of surfaces) {
    const ranges=patches ?? [{first:0,count:indices.length}];
    for(const patch of ranges) {
      if (patch.min && patch.max) {
        let lo=0,hi=nearest?.t ?? 1;
        for(const a of ['x','y','z'] as const) {
          const d=end[a]-start[a];
          if(Math.abs(d)<1e-14) {
            if(start[a]<patch.min[a] || start[a]>patch.max[a]) { hi=-1;break; }
          } else {
            const t1=(patch.min[a]-start[a])/d,t2=(patch.max[a]-start[a])/d;
            lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));
          }
        }
        if(lo>hi) continue;
      }
      for (let i=patch.first;i<patch.first+patch.count;i+=3) {
        const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3;
        const ex=p[b]-p[a],ey=p[b+1]-p[a+1],ez=p[b+2]-p[a+2];
        const fx=p[c]-p[a],fy=p[c+1]-p[a+1],fz=p[c+2]-p[a+2];
        const px=dy*fz-dz*fy,py=dz*fx-dx*fz,pz=dx*fy-dy*fx;
        const det=ex*px+ey*py+ez*pz;
        if (Math.abs(det)<1e-14) continue;
        const sx=start.x-p[a],sy=start.y-p[a+1],sz=start.z-p[a+2];
        const u=(sx*px+sy*py+sz*pz)/det;
        if (u<0 || u>1) continue;
        const qx=sy*ez-sz*ey,qy=sz*ex-sx*ez,qz=sx*ey-sy*ex;
        const v=(dx*qx+dy*qy+dz*qz)/det;
        if (v<0 || u+v>1) continue;
        const t=(fx*qx+fy*qy+fz*qz)/det;
        if (t<0 || t>1 || (nearest && t>=nearest.t)) continue;
        nearest={t,zone:zones[i/3],point:{x:start.x+dx*t,y:start.y+dy*t,z:start.z+dz*t}};
      }
    }
  }
  return nearest;
}
