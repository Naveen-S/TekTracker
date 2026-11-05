/**
 * Roster contact writes (support-oncall.md as-built 15). A RosterContact is keyed by email, so one
 * person has one name + phone across every roster that lists them. Only emails on the team's saved
 * roster are written; an entry with neither name nor phone deletes that person's contact. Contacts
 * for emails dropped from this roster are kept — the person may still be on another team's roster.
 */

/**
 * Write a team's roster contacts inside the caller's interactive `$transaction`, after the team
 * write (so `memberEmails` is the roster as saved, PATCHed or not).
 *
 * @param {import("@/generated/prisma/client").Prisma.TransactionClient} tx
 * @param {string[]} memberEmails the team's saved roster (lowercased)
 * @param {{ email: string, displayName: string | null, phone: string | null }[]} contacts
 * @param {string} userId the editor, recorded FK-less on the row
 */
export async function saveRosterContacts(tx, memberEmails, contacts, userId) {
  const roster = new Set(memberEmails);
  const onRoster = contacts.filter((contact) => roster.has(contact.email));
  const cleared = onRoster.filter((contact) => !contact.displayName && !contact.phone);
  if (cleared.length) {
    await tx.rosterContact.deleteMany({ where: { email: { in: cleared.map((contact) => contact.email) } } });
  }
  for (const { email, displayName, phone } of onRoster) {
    if (!displayName && !phone) continue;
    await tx.rosterContact.upsert({
      where: { email },
      create: { email, displayName, phone, updatedById: userId },
      update: { displayName, phone, updatedById: userId },
    });
  }
}
