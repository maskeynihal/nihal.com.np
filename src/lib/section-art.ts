/**
 * Entry of the section art chunk (S5). SectionArt.astro imports this after idle, from 1024 px only,
 * so none of it counts toward the initial JS. The drawings and the engine live in src/lib/side-art.
 */
export { mountSideArt } from './side-art/engine';
