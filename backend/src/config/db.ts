// Everywhere else in the app imports "prisma" from here instead of creating
// a new database connection each time.
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
