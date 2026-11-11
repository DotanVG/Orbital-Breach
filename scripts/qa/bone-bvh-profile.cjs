// Diagnostic-only source transform. Never included in the production client.
function instrument(code) {
  code=code.replaceAll('\r\n','\n');
  const replace=(from,to)=>{if(!code.includes(from)) throw Error(`Profile anchor missing: ${from}`);code=code.replace(from,to);};
  replace('queryBindBvh, type BindBvh','queryBindBvh as rawQueryBindBvh, type BindBvh');
  replace('segmentHitSurface, segmentIntersectsBounds','segmentHitSurface as rawSegmentHitSurface, segmentIntersectsBounds');
  for(const name of ['skinHitVertex','displacementBounds']) replace(`function ${name}(`,`function raw${name}(`);
  replace('const prepare=()=>{','const prepare=()=>timed("pose/AABB",()=>{');
  if(code.includes('const prepareMatrices=')) {
    replace('  const prepareMatrices=()=>{','  const prepareMatrices=()=>timed("palette",()=>{');
    replace('  };\n  const prepareMatrices=', '  });\n  const prepareMatrices=');
    replace('  };\n  const query:HitSurfaceQuery=', '  });\n  const query:HitSurfaceQuery=');
  } else {
    replace('  };\n  const prepareInverse=', '  });\n  const prepareInverse=');
    replace('  const prepareInverse=(palette:Palette,bone:number)=>{','  const prepareInverse=(palette:Palette,bone:number)=>timed("palette",()=>{');
    replace('  };\n  const boundsFor=', '  });\n  const boundsFor=');
    replace('      p.prepareSkin=i=>{','      p.prepareSkin=i=>timed("palette",()=>{');
    replace('      };\n      palettes.push', '      });\n      palettes.push');
    replace('  const rootMayIntersect=(group:BoneTree,palette:Palette,start:Vec3,end:Vec3)=>{','  const rootMayIntersect=(group:BoneTree,palette:Palette,start:Vec3,end:Vec3)=>timed("root reject",()=>{');
    replace('  };\n  const query:HitSurfaceQuery=', '  });\n  const query:HitSurfaceQuery=');
  }
  replace('    for(const job of jobs) {','    timed("root rays",()=>{for(const job of jobs) {');
  replace('    jobs.sort((a,b)=>a.entry-b.entry);','    }});\n    timed("sort",()=>jobs.sort((a,b)=>a.entry-b.entry));');
  // The original loop closing brace is replaced by the two braces above.
  replace('    }\n    }});','    }});');
  code+=`\n
const profileStack=[];
globalThis.__boneProfile={times:{},counts:{}};
function timed(name,fn) {
  const p=globalThis.__boneProfile,record={child:0},start=performance.now();
  profileStack.push(record);
  try {return fn();} finally {
    const elapsed=performance.now()-start;profileStack.pop();
    if(profileStack.length) profileStack[profileStack.length-1].child+=elapsed;
    p.times[name]=(p.times[name]||0)+elapsed-record.child;
    p.counts[name]=(p.counts[name]||0)+1;
  }
}
function skinHitVertex(...args) {return timed('skin',()=>rawskinHitVertex(...args));}
function displacementBounds(...args) {return timed('certificate',()=>rawdisplacementBounds(...args));}
function queryBindBvh(...args) {return timed('traversal',()=>rawQueryBindBvh(...args));}
function segmentHitSurface(...args) {return timed('triangles',()=>rawSegmentHitSurface(...args));}
`;
  return code;
}
module.exports={instrument};
