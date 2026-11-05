/** Ticket IDs: A-08, E-11, B-06a, B-06b. */
export const isTicketId = (id: string): boolean =>
  /^[A-F]-\d{2}[a-z]?$/.test(id);
