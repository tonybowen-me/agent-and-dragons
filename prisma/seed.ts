import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const INVITE_CODES: { code: string; label: string; maxUses: number }[] = [
  { code: "DRAGON", label: "General open invite", maxUses: 0 },
  { code: "TAVERN", label: "General open invite", maxUses: 0 },
  { code: "CRITICAL-HIT", label: "Limited playtest invite", maxUses: 50 },
  { code: "NAT-20", label: "Limited playtest invite", maxUses: 50 },
];

async function main() {
  for (const invite of INVITE_CODES) {
    await prisma.inviteCode.upsert({
      where: { code: invite.code },
      update: { label: invite.label, maxUses: invite.maxUses, active: true },
      create: invite,
    });
  }
  const codes = await prisma.inviteCode.findMany();
  console.log(
    `Seeded ${codes.length} invite codes: ${codes.map((c) => c.code).join(", ")}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
