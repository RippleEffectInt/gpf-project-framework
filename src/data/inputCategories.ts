import type { InputCategory } from '../types/project'

export const inputCategories: readonly InputCategory[] = [
  { id: 'people-technical-expertise', label: 'People / technical expertise' },
  { id: 'training-facilitation', label: 'Training / facilitation' },
  { id: 'agricultural-inputs', label: 'Agricultural inputs' },
  { id: 'livestock-inputs', label: 'Livestock inputs' },
  { id: 'equipment-tools', label: 'Equipment / tools' },
  { id: 'infrastructure-facilities', label: 'Infrastructure / facilities' },
  { id: 'materials-resources', label: 'Materials / resources' },
  { id: 'transport-logistics', label: 'Transport / logistics' },
  { id: 'digital-data-technology', label: 'Digital / data / technology' },
  { id: 'finance-grants', label: 'Finance / grants' },
  {
    id: 'partner-service-provider-support',
    label: 'Partner / service-provider support',
  },
  { id: 'community-contribution', label: 'Community contribution' },
  { id: 'other', label: 'Other' },
]
