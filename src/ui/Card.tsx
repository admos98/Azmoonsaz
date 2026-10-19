/**
 * @license SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, type HTMLMotionProps } from 'motion/react';

/* ==========================================
   2. CARD COMPONENT
   ========================================== */
/* HTMLMotionProps already unions the DOM div attributes with motion's +
   framer's props — the exact interface the hoverable branch spreads into
   motion.div. Extending it (instead of React.HTMLAttributes) is what let
   the `props as any` cast die: one prop type, both render paths. */
export interface CardProps extends HTMLMotionProps<'div'> {
  hoverable?: boolean;
  glassLayer?: 'light' | 'strong' | 'inset' | 'none';
  /** Landscape of the panel's inner air: none = row flush into its host,
      sm = tight chip/stat air, md = the standard panel rhythm (default). */
  padding?: 'none' | 'sm' | 'md';
  children?: React.ReactNode;
}

const PADDING = {
  none: '',
  sm: 'p-3',
  md: 'p-5 md:p-6',
} as const;

export const Card = ({
  children,
  hoverable = false,
  glassLayer = 'light',
  padding = 'md',
  className = '',
  ...props
}: CardProps) => {
  const glassClass = {
    /* light = top-level section card → the full lens material (bend + the
       reflective rim lives IN the filter, no painted glass-edge ring) */
    light: 'lens',
    /* strong = nested / heavier card → pane: same rim physics, no bend,
       blur 2× lens — the sanctioned glass-inside-glass material */
    strong: 'pane',
    /* inset and none sit INSIDE other panels — rows, not panels. A rim on
       every nested row reads as double-framed plastic; iOS nests rows as
       quiet fills under the host panel's rim. */
    inset: 'glx-inset',
    none: '',
  }[glassLayer];
  const edgeClass = '';

  if (hoverable) {
    return (
      <motion.div
        whileHover={{ y: -4, scale: 1.01 }}
        whileTap={{ scale: 0.995 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className={`${glassClass} ${edgeClass} rounded-xl ${PADDING[padding]} transition-all ${className}`.trim()}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
  /* The static branch takes the plain-div half: HTMLMotionProps' drag
     handlers (framer's signatures) don't overlap React's onDrag*, but the
     hoverable branch is the only producer of those keys — this path gets
     DOM attributes only. unknown-cast once, with intent named. */
  const domProps = props as unknown as React.HTMLAttributes<HTMLDivElement>;
  return (
    <div
      className={`${glassClass} ${edgeClass} rounded-xl ${PADDING[padding]} ${className}`.trim()}
      {...domProps}
    >
      {children}
    </div>
  );
};
