import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Example: Create a sample building from Leszno area
  const building = await prisma.building.create({
    data: {
      polygon: [
        [20.4714069, 52.1233726],
        [20.4714099, 52.1233425],
        [20.4712722, 52.1233373],
        [20.4712824, 52.1232352],
        [20.4714069, 52.1233726]
      ],
      centroidLng: 20.4713,
      centroidLat: 52.1233,
      isAsbestos: false,
      isPotentiallyAsbestos: null, // Not yet processed
    },
  });

  console.log('Created sample building:', building.id);
  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
