// "Off-screen life" — while the user is away the character lives their own day.
// On return we generate a short private diary note and let it colour how the
// character greets the user (it feeds the proactive "texts first" turn).

export function buildOffscreenMessages(charName, userName, gapText, relMood) {
  const sys = 'You write a brief PRIVATE diary note for the character "' + charName + '" about what they did '
    + 'while the user "' + userName + '" was away. 1-2 short sentences, first person, in character, mundane and '
    + 'believable (their real life: work/study, friends, hobbies, small feelings). No greeting to the user, '
    + 'no roleplay asterisks, plain text only.';
  const user = 'The user was away for ' + gapText + '.'
    + (relMood ? ' Your current feeling toward them: ' + relMood + '.' : '')
    + ' What did you (' + charName + ') get up to in that time? Write the diary note.';
  return [{ role: 'system', content: sys }, { role: 'user', content: user }];
}

export function cleanOffscreen(raw) {
  return String(raw || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/[*_`]/g, '')
    .trim()
    .slice(0, 280);
}
