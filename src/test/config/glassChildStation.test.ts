/**
 * M2-A child-glass anchoring — static contract gates (companion to
 * webglGlassPath.test.ts). One station per panel tree: glass children of
 * canvas-drawn parents join the parent's plane draw (same rect clock, same
 * compositor translate), painter-ordered after the parent, with the parent's
 * frozen dim/fill carried into the child's backdrop — what a CSS backdrop
 * root actually passes down. Kept static (source reads) like its parent
 * file; the real pixels are covered by tests/e2e/webgl-glass.spec.ts.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot as root } from '../sourceReader';

const rendererShaders = readFileSync(join(root, 'src/glass/webglShaders.ts'), 'utf8');
const controller = readFileSync(join(root, 'src/glass/glassController.ts'), 'utf8');
const pipelineSrc = readFileSync(join(root, 'src/glass/glassPipeline.ts'), 'utf8');
const flushSrc = readFileSync(join(root, 'src/glass/glassFlush.ts'), 'utf8');
const reportTypes = readFileSync(join(root, 'src/glass/perfReporterTypes.ts'), 'utf8');

/** Comments stripped (same rule as webglGlassPath.test.ts): the doc blocks
 *  discuss the very strings these gates assert. */
const code = (s: string) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

describe('M2-A child-glass anchoring (one station per panel tree)', () => {
  const flushCode = code(flushSrc);
  const controllerCode = code(controller);
  const pipelineCode = code(pipelineSrc);

  it('a glass child inside a canvas-drawn parent joins the canvas station', () => {
    // The flush's nested branch must attempt the child path BEFORE falling
    // back to undressNested, gated on the parent's own eligibility (not its
    // dataset — parent + child can land in the same batch, so a dataset
    // read would strand the child undressed every first flush).
    expect(flushCode).toMatch(
      /isNestedGlass\(el\)[\s\S]{0,600}canvasParentOf\(el\)[\s\S]{0,1800}trackWebglChild/,
    );
    // Eligibility is the pipeline's own gate — order-independent.
    expect(pipelineCode).toMatch(
      /function canvasParentOf[\s\S]{0,300}closest\(GLASS_SELECTOR\)[\s\S]{0,300}webglPlaceable/,
    );
  });

  it('the child keeps its quiet DOM material (data-glass-child, not glass-paint)', () => {
    // data-glass-paint's CSS block transparents backgrounds — a child's
    // de-nest quiet fill must SURVIVE, so children carry a distinct attr
    // and only their filter is killed (inline, like the parents).
    expect(pipelineCode).toContain("el.dataset.glassChild = 'webgl'");
    expect(pipelineCode).not.toMatch(/trackWebglChild[\s\S]{0,400}glassPaint = 'webgl'/);
    // untrack clears BOTH attrs; a former child re-tracked elsewhere must
    // not keep a stale glassChild pointing at a dead station.
    expect(pipelineCode).toMatch(
      /function untrackWebgl[\s\S]{0,300}glassPaint[\s\S]{0,200}glassChild/,
    );
    // The child's paintCache entry carries the parent link.
    expect(pipelineCode).toMatch(/childOf: parent/);
  });

  it('the frame draws parents first, then children with the frozen parent frost', () => {
    expect(controllerCode).toMatch(/const kids[\s\S]{0,300}entry\.childOf/);
    expect(controllerCode).toMatch(
      /entry\.childOf[\s\S]{0,1600}parentPaintFor\(/,
    );
    // Painter order is real: the children pass runs AFTER the parent pass
    // (the second loop over kids).
    expect(controllerCode).toMatch(
      /for \(const el of webglDrawSet\)[\s\S]{0,1200}for \(const \{ el, entry \} of kids\)/,
    );
    // A parent-less child is skipped, never painted on a wrong station.
    expect(controllerCode).toMatch(/if \(!parentEntry\) continue;/);
  });

  it('the shader composes the parent frost: dim wash, veil, fill — in CSS order', () => {
    // The block must live in the GLASS fragment shader, gate on u_pHas, and
    // mirror the panel's own dim pipeline (wash → white-veil → fill mix).
    const fsBlock = rendererShaders.match(/if \(u_pHas > 0\.5\)[\s\S]{0,800}/);
    expect(fsBlock).not.toBeNull();
    expect(fsBlock![0]).toContain('u_pDim');
    expect(fsBlock![0]).toContain('u_pDimLift');
    expect(fsBlock![0]).toContain('mix(pf, u_pFillTint / 255.0, u_pFillA)');
    // Veil law identical to the panel's own: (1−x)² weighted.
    expect(fsBlock![0]).toMatch(/u_pDimLift \* \(vec3\(1\.0\) - pf\) \* \(vec3\(1\.0\) - pf\)/);
    // The controller freezes the parent's fill alpha AT the child's centre
    // along the parent's CSS gradient axis (the position-dependent term).
    expect(pipelineCode).toMatch(
      /function parentPaintFor[\s\S]{0,800}fillA1[\s\S]{0,300}fillA2/,
    );
  });

  it('the perf oracle reports the anchored children', () => {
    expect(controllerCode).toMatch(/drawnChildren: drawnChildCount/);
    expect(reportTypes).toMatch(/drawnChildren: number/);
  });
});
