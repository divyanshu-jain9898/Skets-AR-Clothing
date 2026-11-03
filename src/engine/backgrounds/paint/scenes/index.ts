import type { SceneSpec } from '../scene';
import { crackers } from './crackers';
import { diyas } from './diyas';
import { house } from './house';
import { festive } from './festive';
import { night } from './night';
import { interior } from './interior';

/** All procedural Diwali scenes by id. */
export const SCENES: Record<string, SceneSpec> = { crackers, diyas, house, festive, night, interior };
