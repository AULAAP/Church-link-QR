import { Church } from '../types';

const cities = ["Ciudad de México", "Guadalajara", "Monterrey", "Puebla", "Toluca", "Tijuana", "León", "Juárez", "Zapopan", "Mérida"];

export function generateSeedData(): Church[] {
  const churches: Church[] = [];
  for (let i = 1; i <= 300; i++) {
    const id = i.toString().padStart(3, '0');
    const city = cities[Math.floor(Math.random() * cities.length)];
    const churchName = `Iglesia de ${city} #${id}`;
    
    churches.push({
      id,
      name: churchName,
      responsible: `Líder ${id}`,
      community: `Comunidad ${city}`,
      bookQuantity: Math.floor(10 + Math.random() * 90),
      phoneNumber: `555-${Math.floor(100 + Math.random() * 899)}-${Math.floor(1000 + Math.random() * 8999)}`,
      status: 'Pendiente'
    });
  }
  return churches;
}
