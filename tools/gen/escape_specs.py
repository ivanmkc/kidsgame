"""Little Escapes room specs — data, not code (storybook-pipeline style).

Chain rules (from persistence-of-dreams' generate-scenario skill, scaled
to age 3-6): linear dependency, collect→use→unlock, 2-3 items each used
exactly ONCE, one win spot, tray never holds more than 3, plus one free
"flavor" search spot per room so wrong taps stay fun. Scene prompts
compose every hotspot object LEFT→RIGHT, large and clearly separated
(SAM needs discrete solid objects — no region phrases).

NOTE: escape rooms never touch Veo, so door/key wording is safe here
(the storybook door/key ban exists for Veo's third-party filter only).
"""

ESCAPE_STYLE = ("Bright cheerful children's picture-book illustration, chunky "
                "rounded shapes, bold clean outlines, soft warm palette. "
                "Landscape orientation. No text, no letters, no watermark, "
                "no people.")

ESCAPE_ROOMS = [
    {
        "id": "toyroom",
        "name": "The Sleepy Puppy",
        "level": "easy",
        "scene": ("A wide pastel toy room viewed from the front, four objects placed far apart "
                  "with lots of empty floor between them: on the far LEFT EDGE a big blue "
                  "striped pillow sitting alone on the floor, in the CENTER a big red wooden "
                  "toy chest with a golden padlock sitting alone on the floor, on the RIGHT a "
                  "brown teddy bear sitting alone on a round green rug, on the far RIGHT EDGE "
                  "a golden puppy inside a tall wooden fence pen. Each object is a separate "
                  "standalone item with wide empty space on all sides, evenly spaced across "
                  "the full width of the room."),
        "intro": "Oh no! The puppy is stuck in the toy pen and the gate will not budge. Look around the toy room and help him out!",
        "winText": "Hooray! The puppy is free and SO happy!",
        "items": [
            {"id": "key", "label": "A shiny key!", "emoji": "🗝️"},
            {"id": "bone", "label": "A yummy bone!", "emoji": "🦴"},
        ],
        "hotspots": [
            {"id": "pillow", "spot": "blue striped pillow", "kind": "search", "gives": "key",
             "pop": "a big shiny golden key with a heart-shaped top",
             "sayFound": "A shiny key was hiding under the pillow!"},
            {"id": "teddy", "spot": "brown teddy bear", "kind": "search",
             "saySearch": "The teddy bear giggles. Nothing under here!"},
            {"id": "chest", "spot": "red toy chest", "kind": "lock", "needs": "key", "gives": "bone",
             "pop": "a big happy cartoon bone with a red bow",
             "sayLocked": "The toy chest is locked tight. What could open it?",
             "sayFound": "The chest popped open — a yummy bone!"},
            {"id": "pen", "spot": "golden puppy", "kind": "win", "needs": "bone",
             "sayLocked": "The puppy is hungry. What does a puppy love best?",
             "sayFound": "The puppy wiggles out — you saved him!"},
        ],
    },
    {
        "id": "dragoncave",
        "name": "Dragon's Breakfast",
        "level": "easy",
        "scene": ("A wide dragon cave viewed from the front, four objects placed far apart: "
                  "on the far LEFT EDGE a big golden haystack sitting on the cave floor, "
                  "in the LEFT-CENTER a round glowing purple crystal ball on a stone pedestal, "
                  "in the RIGHT-CENTER a big copper stove sitting alone on the floor, on the "
                  "far RIGHT EDGE a small teal baby dragon sitting on a stone stool. Each "
                  "object is a separate standalone item with clear empty space on all sides."),
        "intro": "The baby dragon is too hungry to fly! Find something yummy and cook him breakfast.",
        "winText": "Yum! The baby dragon is full and zooming again!",
        "items": [
            {"id": "egg", "label": "A big egg!", "emoji": "🥚"},
            {"id": "pancake", "label": "A golden pancake!", "emoji": "🥞"},
        ],
        "hotspots": [
            {"id": "haystack", "spot": "golden haystack", "kind": "search", "gives": "egg",
             "pop": "a big white egg with tiny speckles",
             "sayFound": "An egg was hiding in the hay!"},
            {"id": "crystal", "spot": "purple crystal ball", "kind": "search",
             "saySearch": "The crystal ball shows a yummy breakfast!"},
            {"id": "stove", "spot": "copper stove", "kind": "lock", "needs": "egg", "gives": "pancake",
             "pop": "a golden pancake with melting butter on top",
             "sayLocked": "The stove is ready, but what could we cook?",
             "sayFound": "Sizzle sizzle — a golden pancake!"},
            {"id": "dragon", "spot": "teal baby dragon", "kind": "win", "needs": "pancake",
             "sayLocked": "The baby dragon's tummy is rumbling…",
             "sayFound": "The dragon gobbles it up and puffs a happy little smoke ring!"},
        ],
    },
    {
        "id": "rocketpad",
        "name": "Bunny Blast-Off",
        "level": "medium",
        "scene": ("A wide bright rocket hangar viewed from the front, five objects placed far "
                  "apart in a single row across the scene: on the far LEFT EDGE a big red "
                  "toolbox sitting open on the floor, in the LEFT-CENTER a big round yellow "
                  "poster of the moon hanging high on the wall, in the CENTER a tall silver "
                  "rocket standing alone, in the RIGHT-CENTER a big green battery sitting on "
                  "a wooden crate, on the far RIGHT EDGE a big round blue button on a tall "
                  "white stand. Each object is a separate standalone item with wide empty "
                  "space on all sides, evenly spaced across the full width."),
        "intro": "The bunny's rocket will not start! Find what it needs and help her blast off to the moon.",
        "winText": "Whoosh! The bunny zooms to the moon — thanks to you!",
        "items": [
            {"id": "wrench", "label": "A trusty wrench!", "emoji": "🔧"},
            {"id": "battery", "label": "A super battery!", "emoji": "🔋"},
            {"id": "star", "label": "A glowing star!", "emoji": "⭐"},
        ],
        "hotspots": [
            {"id": "toolbox", "spot": "red toolbox", "kind": "search", "gives": "wrench",
             "pop": "a big red wrench with a smiling face",
             "sayFound": "A trusty wrench!"},
            {"id": "poster", "spot": "yellow moon poster", "kind": "search",
             "saySearch": "That is where the bunny wants to go!"},
            {"id": "rocket", "spot": "silver rocket", "kind": "lock", "needs": "wrench", "gives": "battery",
             "pop": "a chunky green battery with a lightning bolt",
             "sayLocked": "The rocket panel is stuck. We need a tool!",
             "sayFound": "The panel opened — a super battery!"},
            {"id": "crate", "spot": "green battery", "kind": "lock", "needs": "battery", "gives": "star",
             "pop": "a glowing golden star with a happy face",
             "sayLocked": "The power slot is empty…",
             "sayFound": "Power on! A glowing star popped out!"},
            {"id": "button", "spot": "blue button", "kind": "win", "needs": "star",
             "sayLocked": "The launch button needs star power!",
             "sayFound": "Three, two, one — BLAST OFF!"},
        ],
    },
    {
        "id": "piratecove",
        "name": "The Pelican Trade",
        "level": "medium",
        "scene": ("A wide sunny pirate cove beach viewed from the front, four objects placed "
                  "far apart in a single row across the golden sand: on the far LEFT EDGE a "
                  "big grey rock with a green fishing net draped over it, in the LEFT-CENTER "
                  "a big red striped beach umbrella stuck in the sand, in the RIGHT-CENTER a "
                  "big white pelican standing on a wooden post, on the far RIGHT EDGE a big "
                  "brown wooden treasure chest half buried in golden sand. Each object is a "
                  "separate standalone item with wide empty space on all sides, evenly spaced "
                  "across the full width."),
        "intro": "A treasure chest washed up on the beach, but it will not open! Look around the cove for a way in.",
        "winText": "Treasure! You are the cleverest little pirate!",
        "items": [
            {"id": "fish", "label": "A wiggly fish!", "emoji": "🐟"},
            {"id": "shell", "label": "A shiny shell!", "emoji": "🐚"},
        ],
        "hotspots": [
            {"id": "net", "spot": "green fishing net", "kind": "search", "gives": "fish",
             "pop": "a silly smiling blue fish",
             "sayFound": "A wiggly fish!"},
            {"id": "umbrella", "spot": "red beach umbrella", "kind": "search",
             "saySearch": "Just a shady spot. Nothing hidden here!"},
            {"id": "pelican", "spot": "white pelican", "kind": "lock", "needs": "fish", "gives": "shell",
             "pop": "a shiny rainbow seashell sparkling with light",
             "sayLocked": "The pelican wants a snack first…",
             "sayFound": "The pelican trades you a shiny shell!"},
            {"id": "chest", "spot": "brown treasure chest", "kind": "win", "needs": "shell",
             "sayLocked": "The treasure chest has a shell-shaped slot!",
             "sayFound": "The chest bursts open — treasure for everyone!"},
        ],
    },
]
