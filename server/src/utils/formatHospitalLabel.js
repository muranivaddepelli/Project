/**
 * @param {{ name?: string, address?: string } | null | undefined} hospital
 */
function formatHospitalLabel(hospital) {
  if (!hospital) return '';
  const name = (hospital.name || '').trim();
  const address = (hospital.address || '').trim();
  if (name && address) return `${name} — ${address}`;
  return name || address;
}

module.exports = { formatHospitalLabel };
