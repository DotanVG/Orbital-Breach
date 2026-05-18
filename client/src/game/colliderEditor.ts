import * as THREE from 'three';
import type { HitZone } from '../player/playerTypes';
import {
  type ColliderShape,
  type HitZoneCollider,
  cloneColliders,
  defaultHitZoneColliders,
  makeCollider,
  serializeColliders,
} from '../player/hitZoneColliders';

// ── Constants ────────────────────────────────────────────────────────────────

const MOVE_STEP   = 0.005;   // world-units per frame at 60 fps
const RESIZE_STEP = 0.002;
const ROT_STEP    = 0.005;   // radians per frame

const ZONE_COLORS: Record<HitZone, number> = {
  head:     0xff4444,
  body:     0xffaa00,
  leftArm:  0x44aaff,
  rightArm: 0x44ffdd,
  leftLeg:  0xaa44ff,
  rightLeg: 0xffff44,
};

const ZONE_LABELS: Record<HitZone, string> = {
  head:     'Head',
  body:     'Body',
  leftArm:  'Left Arm',
  rightArm: 'Right Arm',
  leftLeg:  'Left Leg',
  rightLeg: 'Right Leg',
};

const ALL_ZONES: HitZone[]      = ['head', 'body', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'];
const ALL_SHAPES: ColliderShape[] = ['box', 'sphere', 'capsule'];
const SPHERE_SEGS = 10;

// ── Mesh builders ────────────────────────────────────────────────────────────

function makeBoxMesh(col: HitZoneCollider): THREE.Mesh {
  const geo = new THREE.BoxGeometry(
    col.size.x * 2, col.size.y * 2, col.size.z * 2,
  );
  const mat = new THREE.MeshBasicMaterial({
    color: ZONE_COLORS[col.zone],
    wireframe: true,
    transparent: true,
    opacity: 0.9,
  });
  return new THREE.Mesh(geo, mat);
}

function makeSphereMesh(col: HitZoneCollider): THREE.Mesh {
  const geo = new THREE.SphereGeometry(col.size.x, SPHERE_SEGS, SPHERE_SEGS / 2);
  const mat = new THREE.MeshBasicMaterial({
    color: ZONE_COLORS[col.zone],
    wireframe: true,
    transparent: true,
    opacity: 0.9,
  });
  return new THREE.Mesh(geo, mat);
}

function makeCapsuleMesh(col: HitZoneCollider): THREE.Mesh {
  // Approximated as a cylinder for wireframe display
  const geo = new THREE.CylinderGeometry(col.size.x, col.size.x, col.size.y * 2, 10, 1, true);
  const mat = new THREE.MeshBasicMaterial({
    color: ZONE_COLORS[col.zone],
    wireframe: true,
    transparent: true,
    opacity: 0.9,
  });
  return new THREE.Mesh(geo, mat);
}

function buildMesh(col: HitZoneCollider): THREE.Mesh {
  if (col.shape === 'sphere')  return makeSphereMesh(col);
  if (col.shape === 'capsule') return makeCapsuleMesh(col);
  return makeBoxMesh(col);
}

function disposeMesh(m: THREE.Mesh): void {
  m.geometry.dispose();
  const mat = m.material;
  if (Array.isArray(mat)) mat.forEach(x => x.dispose());
  else mat.dispose();
}

// ── ColliderEditor ───────────────────────────────────────────────────────────

export class ColliderEditor {
  private visible       = false;
  private colliders     : HitZoneCollider[] = cloneColliders(defaultHitZoneColliders);
  private selectedIndex = 0;

  private group  = new THREE.Group();
  private meshes : THREE.Mesh[] = [];

  private panel     : HTMLDivElement;
  private listEl    : HTMLDivElement;
  private propsEl   : HTMLDivElement;

  // Keydown listener registered on window for discrete actions (add/delete/cycle)
  private readonly boundKeyDown: (e: KeyboardEvent) => void;

  public constructor(private readonly scene: THREE.Scene) {
    this.group.visible = false;
    scene.add(this.group);

    const { panel, listEl, propsEl } = this.createPanel();
    this.panel   = panel;
    this.listEl  = listEl;
    this.propsEl = propsEl;

    this.rebuildAllMeshes();

    this.boundKeyDown = this.onKeyDown.bind(this);
    window.addEventListener('keydown', this.boundKeyDown);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  public isVisible(): boolean { return this.visible; }

  public toggle(): void { this.setVisible(!this.visible); }

  public setVisible(v: boolean): void {
    this.visible            = v;
    this.group.visible      = v;
    this.panel.style.display = v ? 'flex' : 'none';
    if (v) this.renderPanel();
  }

  /**
   * Called each frame from gameApp when the editor might be visible.
   * axes — from input.getColliderEditorAxes(); playerPos — local player world pos.
   */
  public tick(
    playerPos: THREE.Vector3,
    axes: {
      move:     { x: number; y: number; z: number };
      resize:   { x: number; y: number; z: number };
      rotation: { x: number; y: number; z: number };
    },
  ): void {
    if (!this.visible) return;
    this.applyAxes(axes);
    this.updateMeshWorldPositions(playerPos);
    this.renderPanel();
  }

  public dispose(): void {
    window.removeEventListener('keydown', this.boundKeyDown);
    this.clearAllMeshes();
    this.scene.remove(this.group);
    this.panel.remove();
  }

  // ── Axis application ───────────────────────────────────────────────────────

  private applyAxes(axes: {
    move:     { x: number; y: number; z: number };
    resize:   { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
  }): void {
    const col = this.colliders[this.selectedIndex];
    if (!col) return;

    const m = axes.move;
    const r = axes.resize;
    const rot = axes.rotation;

    if (m.x || m.y || m.z) {
      col.position.x += m.x * MOVE_STEP;
      col.position.y += m.y * MOVE_STEP;
      col.position.z += m.z * MOVE_STEP;
    }
    if (r.x || r.y || r.z) {
      col.size.x = Math.max(0.01, col.size.x + r.x * RESIZE_STEP);
      col.size.y = Math.max(0.01, col.size.y + r.y * RESIZE_STEP);
      col.size.z = Math.max(0.01, col.size.z + r.z * RESIZE_STEP);
    }
    if (rot.x || rot.y || rot.z) {
      col.rotation.x += rot.x * ROT_STEP;
      col.rotation.y += rot.y * ROT_STEP;
      col.rotation.z += rot.z * ROT_STEP;
    }

    if (m.x || m.y || m.z || r.x || r.y || r.z || rot.x || rot.y || rot.z) {
      this.refreshMesh(this.selectedIndex);
    }
  }

  // ── Three.js mesh management ───────────────────────────────────────────────

  private rebuildAllMeshes(): void {
    this.clearAllMeshes();
    for (let i = 0; i < this.colliders.length; i++) {
      const mesh = buildMesh(this.colliders[i]);
      this.group.add(mesh);
      this.meshes.push(mesh);
    }
  }

  private clearAllMeshes(): void {
    for (const m of this.meshes) {
      this.group.remove(m);
      disposeMesh(m);
    }
    this.meshes = [];
  }

  /** Rebuild the mesh for collider at index (shape/size changed). */
  private refreshMesh(index: number): void {
    const old = this.meshes[index];
    if (old) {
      this.group.remove(old);
      disposeMesh(old);
    }
    const col  = this.colliders[index];
    const mesh = buildMesh(col);
    this.group.add(mesh);
    this.meshes[index] = mesh;
    this.applyMeshTransform(index);
    this.highlightSelected();
  }

  /** Position/rotate each mesh relative to the player world pos. */
  private updateMeshWorldPositions(playerPos: THREE.Vector3): void {
    for (let i = 0; i < this.colliders.length; i++) {
      const col  = this.colliders[i];
      const mesh = this.meshes[i];
      if (!mesh) continue;
      mesh.position.set(
        playerPos.x + col.position.x,
        playerPos.y + col.position.y,
        playerPos.z + col.position.z,
      );
      mesh.rotation.set(col.rotation.x, col.rotation.y, col.rotation.z);
    }
  }

  private applyMeshTransform(index: number): void {
    const col  = this.colliders[index];
    const mesh = this.meshes[index];
    if (!mesh) return;
    mesh.rotation.set(col.rotation.x, col.rotation.y, col.rotation.z);
  }

  private highlightSelected(): void {
    for (let i = 0; i < this.meshes.length; i++) {
      const mesh = this.meshes[i];
      if (!mesh) continue;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity  = i === this.selectedIndex ? 1.0 : 0.45;
      mat.color.setHex(
        i === this.selectedIndex
          ? 0xffffff
          : ZONE_COLORS[this.colliders[i].zone],
      );
    }
  }

  // ── Keyboard (discrete actions) ────────────────────────────────────────────

  private onKeyDown(e: KeyboardEvent): void {
    if (!this.visible) return;
    // Don't steal keys from text fields
    const tag = (document.activeElement as HTMLElement | null)?.tagName ?? '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    switch (e.code) {
      case 'Comma':      this.selectPrev();      e.preventDefault(); break;
      case 'Period':     this.selectNext();      e.preventDefault(); break;
      case 'KeyN':       this.addCollider();     e.preventDefault(); break;
      case 'Delete':     this.deleteSelected();  e.preventDefault(); break;
      case 'KeyG':       this.cycleZone();       e.preventDefault(); break;
      case 'KeyF':       this.cycleShape();      e.preventDefault(); break;
      case 'Enter':      void this.printColliders(); e.preventDefault(); break;
      case 'Backspace':  this.resetCollider();   e.preventDefault(); break;
    }
  }

  private selectPrev(): void {
    if (this.colliders.length === 0) return;
    this.selectedIndex = (this.selectedIndex - 1 + this.colliders.length) % this.colliders.length;
    this.highlightSelected();
  }

  private selectNext(): void {
    if (this.colliders.length === 0) return;
    this.selectedIndex = (this.selectedIndex + 1) % this.colliders.length;
    this.highlightSelected();
  }

  private addCollider(): void {
    const zone  = ALL_ZONES[this.selectedIndex % ALL_ZONES.length];
    const col   = makeCollider(zone, 'box');
    this.colliders.push(col);
    const mesh = buildMesh(col);
    this.group.add(mesh);
    this.meshes.push(mesh);
    this.selectedIndex = this.colliders.length - 1;
    this.highlightSelected();
  }

  private deleteSelected(): void {
    if (this.colliders.length === 0) return;
    const mesh = this.meshes[this.selectedIndex];
    if (mesh) {
      this.group.remove(mesh);
      disposeMesh(mesh);
    }
    this.colliders.splice(this.selectedIndex, 1);
    this.meshes.splice(this.selectedIndex, 1);
    this.selectedIndex = Math.min(this.selectedIndex, this.colliders.length - 1);
    this.highlightSelected();
  }

  private cycleZone(): void {
    const col = this.colliders[this.selectedIndex];
    if (!col) return;
    const idx  = ALL_ZONES.indexOf(col.zone);
    col.zone   = ALL_ZONES[(idx + 1) % ALL_ZONES.length];
    this.refreshMesh(this.selectedIndex);
  }

  private cycleShape(): void {
    const col  = this.colliders[this.selectedIndex];
    if (!col) return;
    const idx  = ALL_SHAPES.indexOf(col.shape);
    col.shape  = ALL_SHAPES[(idx + 1) % ALL_SHAPES.length];
    this.refreshMesh(this.selectedIndex);
  }

  private resetCollider(): void {
    const col = this.colliders[this.selectedIndex];
    if (!col) return;
    col.position = { x: 0, y: 0, z: 0 };
    col.size     = { x: 0.15, y: 0.15, z: 0.15 };
    col.rotation = { x: 0, y: 0, z: 0 };
    this.refreshMesh(this.selectedIndex);
  }

  private async printColliders(): Promise<void> {
    const json = serializeColliders(this.colliders);
    console.info('[ColliderEditor] Current colliders:\n' + json);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(json);
        console.info('[ColliderEditor] Copied to clipboard.');
      }
    } catch {
      // clipboard not available (pointer locked) — values already in console
    }
  }

  // ── DOM panel ─────────────────────────────────────────────────────────────

  private createPanel(): { panel: HTMLDivElement; listEl: HTMLDivElement; propsEl: HTMLDivElement } {
    const panel = document.createElement('div');
    Object.assign(panel.style, {
      position:       'fixed',
      top:            '50%',
      right:          '16px',
      transform:      'translateY(-50%)',
      zIndex:         '200',
      width:          '310px',
      maxHeight:      '90vh',
      overflowY:      'auto',
      display:        'none',
      flexDirection:  'column',
      gap:            '6px',
      padding:        '12px',
      background:     'rgba(2, 8, 24, 0.90)',
      border:         '1px solid rgba(0,255,200,0.4)',
      borderRadius:   '10px',
      color:          '#c8fff0',
      font:           '11px/1.5 monospace',
      pointerEvents:  'none',
    });

    const title = document.createElement('div');
    Object.assign(title.style, {
      fontSize: '13px',
      fontWeight: 'bold',
      color: '#00ffd0',
      borderBottom: '1px solid rgba(0,255,200,0.2)',
      paddingBottom: '6px',
      marginBottom: '4px',
    });
    title.textContent = '▣ COLLIDER EDITOR';

    const listLabel = this.makeLabel('COLLIDERS');
    const listEl    = document.createElement('div');
    Object.assign(listEl.style, { display: 'flex', flexDirection: 'column', gap: '2px' });

    const propsLabel = this.makeLabel('SELECTED');
    const propsEl    = document.createElement('div');

    const help = document.createElement('div');
    Object.assign(help.style, {
      marginTop: '6px',
      borderTop: '1px solid rgba(0,255,200,0.15)',
      paddingTop: '6px',
      color: 'rgba(180,255,230,0.55)',
      fontSize: '10px',
      lineHeight: '1.6',
    });
    help.innerHTML = [
      ',/. — prev/next collider',
      'Arrows/PgUp/PgDn — move XYZ',
      'Shift+Arrows/PgUp/PgDn — resize',
      'I/K J/L U/O — rotate',
      'N — new collider',
      'Delete — delete selected',
      'G — cycle body part',
      'F — cycle shape',
      'Enter — print/copy JSON',
      'Backspace — reset to zero',
      '] — close editor',
    ].join('<br>');

    panel.append(title, listLabel, listEl, propsLabel, propsEl, help);
    document.body.appendChild(panel);

    return { panel, listEl, propsEl };
  }

  private makeLabel(text: string): HTMLDivElement {
    const el = document.createElement('div');
    Object.assign(el.style, {
      fontSize: '9px',
      letterSpacing: '0.1em',
      color: 'rgba(0,255,200,0.5)',
      marginBottom: '2px',
    });
    el.textContent = text;
    return el;
  }

  private renderPanel(): void {
    this.renderList();
    this.renderProps();
  }

  private renderList(): void {
    this.listEl.innerHTML = '';
    for (let i = 0; i < this.colliders.length; i++) {
      const col     = this.colliders[i];
      const isActive = i === this.selectedIndex;
      const row      = document.createElement('div');
      const hex      = ZONE_COLORS[col.zone].toString(16).padStart(6, '0');
      Object.assign(row.style, {
        display:      'flex',
        alignItems:   'center',
        gap:          '6px',
        padding:      '3px 6px',
        borderRadius: '4px',
        background:   isActive ? 'rgba(0,255,200,0.12)' : 'transparent',
        border:       isActive ? '1px solid rgba(0,255,200,0.35)' : '1px solid transparent',
      });
      const dot = document.createElement('span');
      Object.assign(dot.style, {
        display:      'inline-block',
        width:        '8px',
        height:       '8px',
        borderRadius: col.shape === 'sphere' ? '50%' : '2px',
        background:   '#' + hex,
        flexShrink:   '0',
      });
      const label = document.createElement('span');
      label.textContent = `${i}: ${ZONE_LABELS[col.zone]} (${col.shape})`;
      row.append(dot, label);
      if (isActive) {
        const arrow = document.createElement('span');
        arrow.style.marginLeft = 'auto';
        arrow.style.color = '#00ffd0';
        arrow.textContent = '◀';
        row.appendChild(arrow);
      }
      this.listEl.appendChild(row);
    }
    if (this.colliders.length === 0) {
      const empty = document.createElement('div');
      empty.style.color = 'rgba(180,255,230,0.35)';
      empty.textContent = '(empty — press N to add)';
      this.listEl.appendChild(empty);
    }
  }

  private renderProps(): void {
    const col = this.colliders[this.selectedIndex];
    if (!col) {
      this.propsEl.textContent = '';
      return;
    }
    const p = col.position;
    const s = col.size;
    const r = col.rotation;
    const hex = ZONE_COLORS[col.zone].toString(16).padStart(6, '0');
    this.propsEl.innerHTML = `
<div style="display:grid;grid-template-columns:60px 1fr;gap:2px 8px;margin-top:4px">
  <span style="color:rgba(180,255,230,0.5)">zone</span>
  <span style="color:#${hex}">${ZONE_LABELS[col.zone]}</span>
  <span style="color:rgba(180,255,230,0.5)">shape</span>
  <span>${col.shape}</span>
  <span style="color:rgba(180,255,230,0.5)">pos</span>
  <span>${fmt(p.x)} ${fmt(p.y)} ${fmt(p.z)}</span>
  <span style="color:rgba(180,255,230,0.5)">size</span>
  <span>${fmt(s.x)} ${fmt(s.y)} ${fmt(s.z)}</span>
  <span style="color:rgba(180,255,230,0.5)">rot°</span>
  <span>${fmtDeg(r.x)} ${fmtDeg(r.y)} ${fmtDeg(r.z)}</span>
</div>`.trim();
  }
}

function fmt(n: number): string {
  return n.toFixed(3).padStart(7);
}

function fmtDeg(rad: number): string {
  return ((rad * 180) / Math.PI).toFixed(1).padStart(6) + '°';
}
