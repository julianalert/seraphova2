import type { Sign } from "./chart";

// U+FE0E asks the browser for the text glyph rather than the emoji.
const T = "︎";

export const SIGN_GLYPH: Record<Sign, string> = {
  Aries: `♈${T}`,
  Taurus: `♉${T}`,
  Gemini: `♊${T}`,
  Cancer: `♋${T}`,
  Leo: `♌${T}`,
  Virgo: `♍${T}`,
  Libra: `♎${T}`,
  Scorpio: `♏${T}`,
  Sagittarius: `♐${T}`,
  Capricorn: `♑${T}`,
  Aquarius: `♒${T}`,
  Pisces: `♓${T}`,
};

export const BODY_GLYPH: Record<string, string> = {
  Sun: `☉${T}`,
  Moon: `☽${T}`,
  Mercury: `☿${T}`,
  Venus: `♀${T}`,
  Mars: `♂${T}`,
  Jupiter: `♃${T}`,
  Saturn: `♄${T}`,
  Uranus: `♅${T}`,
  Neptune: `♆${T}`,
  Pluto: `♇${T}`,
  "North Node": `☊${T}`,
};

type Lines = { sun: string; moon: string; rising: string };

/** One line each for the three placements people know best. */
export const SIGN_LINES: Record<Sign, Lines> = {
  Aries: {
    sun: "You come alive at the start of things, and you would rather act and adjust than wait.",
    moon: "You feel things fast and all at once, and you need room to move through them.",
    rising: "People meet your directness first: you walk in already in motion.",
  },
  Taurus: {
    sun: "You build slowly and for keeps, and you trust what you can touch.",
    moon: "You are steadied by comfort, ritual and things that stay put.",
    rising: "People meet your calm first: unhurried, and hard to push.",
  },
  Gemini: {
    sun: "You think by talking, and you are most yourself when you are learning something new.",
    moon: "You settle your feelings by naming them, turning them over out loud.",
    rising: "People meet your quickness first: curious, and already asking questions.",
  },
  Cancer: {
    sun: "You lead with care, and you remember everything that ever mattered to you.",
    moon: "You feel the mood of a room before a word is said, and you need a safe place to return to.",
    rising: "People meet your gentleness first, and only later the strength under it.",
  },
  Leo: {
    sun: "You are here to be fully seen, and you are generous with your warmth.",
    moon: "You need to feel chosen, and you love with your whole chest.",
    rising: "People meet your presence first: you are hard to overlook.",
  },
  Virgo: {
    sun: "You notice what everyone else missed, and you show love by making things work.",
    moon: "You feel calmer once things are in order, and you worry as a way of caring.",
    rising: "People meet your composure first: precise, observant, quietly helpful.",
  },
  Libra: {
    sun: "You see every side, and you are at your best making things fair and beautiful.",
    moon: "You need harmony around you, and discord sits in your body until it is resolved.",
    rising: "People meet your grace first: you put them at ease without trying.",
  },
  Scorpio: {
    sun: "You go all the way down, and you would take one true thing over ten pleasant ones.",
    moon: "You feel with great intensity and let very few people see it.",
    rising: "People meet your gaze first: you see more than you say.",
  },
  Sagittarius: {
    sun: "You need a horizon, and you tell the truth even when it costs you.",
    moon: "You feel better in motion, and you need to believe things are heading somewhere.",
    rising: "People meet your openness first: frank, funny, hard to pin down.",
  },
  Capricorn: {
    sun: "You play the long game, and you carry more than people realise.",
    moon: "You steady yourself by being useful, and you feel things in private.",
    rising: "People meet your seriousness first, and the dry humour second.",
  },
  Aquarius: {
    sun: "You see the pattern before others do, and you refuse to be anyone but yourself.",
    moon: "You need space to feel things your own way and in your own time.",
    rising: "People meet your independence first: friendly, and a step apart.",
  },
  Pisces: {
    sun: "You absorb the world around you, and your imagination is your native country.",
    moon: "You feel what others feel, and you need quiet to tell what is yours.",
    rising: "People meet your softness first: something in you is always listening.",
  },
};
