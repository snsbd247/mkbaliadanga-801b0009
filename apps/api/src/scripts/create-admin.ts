/**
 * Create / reset a super-admin user.
 * Usage (inside container):
 *   node dist/scripts/create-admin.js <email> <password> [full_name]
 */
import { PrismaClient, AppRole } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  const [email, password, fullName = "Super Admin"] = process.argv.slice(2);
  if (!email || !password) {
    console.error("Usage: create-admin <email> <password> [full_name]");
    process.exit(1);
  }
  const office = await prisma.office.findFirst({ where: { code: "MKB" } });
  if (!office) {
    console.error("No office found — run seed first.");
    process.exit(1);
  }
  const hash = await argon2.hash(password);
  const user = await prisma.user.upsert({
    where: { email },
    update: { password_hash: hash, is_active: true, email_verified: true },
    create: { email, password_hash: hash, email_verified: true },
  });
  await prisma.profile.upsert({
    where: { user_id: user.id },
    update: { full_name: fullName, office_id: office.id },
    create: { user_id: user.id, full_name: fullName, office_id: office.id },
  });
  await prisma.userRole.upsert({
    where: { user_id_office_id_role: { user_id: user.id, office_id: office.id, role: AppRole.super_admin } },
    update: {},
    create: { user_id: user.id, office_id: office.id, role: AppRole.super_admin },
  });
  console.log(`✓ super_admin ready: ${email}`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
