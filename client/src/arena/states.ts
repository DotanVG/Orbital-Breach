// Compatibility re-export: the deterministic arena generator now lives in
// shared/ so the server can later reuse it for authoritative layout broadcasts.
// Legacy STATE_A/B/C presets were unreferenced and have been removed.
export { generateArenaLayout, type GeneratedLayout } from '../../../shared/arena-gen';
