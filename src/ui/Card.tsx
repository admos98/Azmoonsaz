/**
 * @license SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';

/* ==========================================
   2. CARD COMPONENT
   ========================================== */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  glassLayer?: 'light' | 'strong' | 'inset';
  children?: React.ReactNode;
  className?: string;
  id?: string;
  key?: React.Key;
}

export const Card = ({
  children,
  hoverable = false,
  glassLayer = 'light',
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spreadProps = props as any;
    return (
      <motion.div
        whileHover={{ y: -4, scale: 1.01 }}
        whileTap={{ scale: 0.995 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className={`${glassClass} ${edgeClass} rounded-xl p-5 md:p-6 transition-all ${className}`.trim()}
        {...spreadProps}
      >
        {children}
      </motion.div>
    );
  }
  return (
    <div
      className={`${glassClass} ${edgeClass} rounded-xl p-5 md:p-6 ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
};
