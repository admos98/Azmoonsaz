/**
 * @license SPDX-License-Identifier: Apache-2.0
 */

import { Search } from 'lucide-react';
import { Input, type InputProps } from './Input';

/* ==========================================
   20. SEARCH INPUT COMPONENT
   ========================================== */
export type SearchInputProps = Omit<InputProps, 'type' | 'icon'>;

export const SearchInput = (props: SearchInputProps) => {
  return <Input type="search" icon={<Search className="h-4 w-4" />} {...props} />;
};
