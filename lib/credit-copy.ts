export function stripCreditBalanceCopy(content: string) {
  return content
    .replace(/\s*You have\s+\d+\s+credits?\s+remaining\.?/gi, "")
    .replace(/\s*Your (?:current )?credit balance is\s+\d+\s+credits?\.?/gi, "")
    .trim();
}
