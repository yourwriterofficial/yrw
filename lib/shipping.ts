export const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT Abuja', 'Gombe',
  'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos',
  'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto',
  'Taraba', 'Yobe', 'Zamfara',
] as const;

export interface ShippingZoneRow {
  id: string;
  site_id?: string;
  name: string;
  states: string[];
  fee: number;
  free_over: number | null;
  is_active: boolean;
}

export interface ComputedShipping {
  fee: number;
  zoneName: string;
  freeDeliveryApplied: boolean;
}

export function computeShipping({
  deliveryMethod,
  state,
  subtotalAfterDiscount,
  zones,
}: {
  deliveryMethod: 'delivery' | 'pickup';
  state?: string;
  subtotalAfterDiscount: number;
  zones: ShippingZoneRow[];
}): ComputedShipping {
  if (deliveryMethod === 'pickup') {
    return { fee: 0, zoneName: 'Store pickup', freeDeliveryApplied: false };
  }

  const active = zones.filter((z) => z.is_active);
  if (active.length === 0) {
    return { fee: 0, zoneName: '', freeDeliveryApplied: false };
  }

  const normalized = (state || '').trim().toLowerCase();
  // Exact state match wins; otherwise fall back to catch-all zones (states includes "Other" or empty states list).
  const matched =
    (normalized
      ? active.find((z) => z.states.some((s) => s.trim().toLowerCase() === normalized))
      : undefined) ||
    active.find((z) => z.states.some((s) => s.trim().toLowerCase() === 'other' || s.trim().toLowerCase() === 'all states')) ||
    active.find((z) => z.states.length === 0);

  if (!matched) {
    return { fee: 0, zoneName: '', freeDeliveryApplied: false };
  }

  const fee = Math.max(0, Number(matched.fee) || 0);
  const freeOver = matched.free_over !== null && matched.free_over !== undefined ? Number(matched.free_over) : null;
  if (freeOver !== null && subtotalAfterDiscount >= freeOver) {
    return { fee: 0, zoneName: matched.name, freeDeliveryApplied: true };
  }
  return { fee, zoneName: matched.name, freeDeliveryApplied: false };
}
