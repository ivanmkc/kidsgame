"""Story Path content specs — data, not code.

Node fields: scene (image prompt), text (spoken), choices, and optionally
scare = {spot: SAM prompt for the dare region, pop: sprite prompt,
reveal: spoken line, sting: boing|thunder, delay: ms before the reveal}.
Story fields: style (art override), ref = {file, prompt} for an explicit
identity anchor (e.g. a monster cast lineup) instead of the start scene.
"""

LUNA = ("Luna, a small white unicorn foal with a curly rainbow mane and tail, "
        "big friendly eyes and a tiny golden horn")
PIP = ("Pip, a chubby golden puppy with floppy ears, a red collar with a bone "
       "tag, and a happy open-mouth smile")
MILO = ("Milo, a small black kitten with huge amber eyes, a white chest patch, "
        "carrying a tiny glowing yellow lantern")
MO = ("Mo, a small round mint-green monster with one big friendly eye, tiny "
      "nub horns and stubby arms")
CAST = ("the Scare School monsters: Principal Growlbert (a huge shaggy purple "
        "furball monster with kind eyes and small glasses), Fangsley (a skinny "
        "yellow monster who is mostly a giant toothy grin), Blobbina (a round "
        "jiggly pink blob monster with long eyelashes), Sir Stretch (a tall "
        "blue monster with impossibly long noodle arms), and the Twins (one "
        "orange two-headed monster whose heads argue)")

SPOOKY_STYLE = ("Moody nighttime children's picture-book illustration: deep "
                "blues and purples, long dramatic shadows, warm lantern glow, "
                "lightning light through windows, soft rounded shapes, "
                "atmospheric but kid-friendly. Landscape orientation. No text, "
                "no letters, no watermark, no people.")

WHISPERING_HOUSE = {
    "id": "whisper",
    "title": "The Whispering House",
    "character": MILO,
    "style": SPOOKY_STYLE,
    "nodes": {
        "start": {
            "scene": f"{MILO} standing at the creaking gate of a tall dark old house on a hill, thunderstorm sky, one window glowing faintly",
            "text": "Milo must fetch grandma's key from the old house on the hill. The wind whispers his name...",
            "scare": {"spot": "gnarled bush beside the gate", "pop": "a startled crow bursting upward with wings spread wide, feathers flying",
                      "reveal": "Just an old crow! It was sleeping in the bush. Keep going, Milo...", "sting": "thunder", "delay": 1600},
            "choices": [{"label": "Creep through the front door 🚪", "next": "a"},
                        {"label": "Sneak around the back 🌙", "next": "b"}],
        },
        "a": {
            "scene": f"{MILO} inside a dark grand hallway with a tall staircase, portraits with eyes in shadow, lantern casting long shadows, something small skittering at the edge of the light",
            "text": "The hallway is dark and TOO quiet. Something is scratching inside the closet... it knows Milo is there.",
            "scare": {"spot": "the tall closet door", "pop": "a shivering wet raccoon in a tiny raincoat mid-leap, eyes wide",
                      "reveal": "A soggy raccoon! 'Sorry,' he sniffles, 'I was cold.' He points upstairs with his tail.", "sting": "thunder", "delay": 1900},
            "choices": [{"label": "Climb the creaky stairs 🕯️", "next": "aa"},
                        {"label": "Follow the skittering sound 🐾", "next": "ab"}],
        },
        "b": {
            "scene": f"{MILO} in an overgrown moonlit back garden, crooked greenhouse, fog curling on the grass, a rusty cellar door slightly open with darkness below",
            "text": "In the garden, the fog moves like it's alive. The cellar door groans open by itself. Something breathes down there.",
            "scare": {"spot": "the dark open cellar door", "pop": "three tiny glowing-eyed hedgehogs stacked on each other wearing one long scarf, tumbling out",
                      "reveal": "Three hedgehogs in one scarf! They were hiding from the storm. The smallest one giggles.", "sting": "thunder", "delay": 1700},
            "choices": [{"label": "Go down into the cellar 🔦", "next": "ba"},
                        {"label": "Tiptoe to the greenhouse 🌿", "next": "bb"}],
        },
        "aa": {
            "scene": f"{MILO} at the top of the stairs in a dusty attic corridor, moonlight stripes through shutters, an old music box on a table glowing softly, a door at the end rattling",
            "text": "Upstairs, a music box plays all by itself... and the door at the end of the hall is RATTLING.",
            "scare": {"spot": "the rattling door at the end of the hall", "pop": "a joyful old ghost-grey cat in a nightcap bursting through with open arms",
                      "reveal": "It's Great-Grandcat Whiskers! 'Visitors! Finally!' he laughs. He knows where the key is...", "sting": "thunder", "delay": 2000},
            "choices": [{"label": "Hug Great-Grandcat 💜", "next": "end_family"},
                        {"label": "Ask about the key 🗝️", "next": "end_key"}],
        },
        "ab": {
            "scene": f"{MILO} in a grand dark library, books floating gently off shelves, a big armchair facing away with something's tail visible, whispering sounds all around",
            "text": "In the library the whispers are LOUD now. The big chair creaks. Something's tail twitches behind it...",
            "scare": {"spot": "the big armchair facing away", "pop": "a wide-eyed owl librarian in tiny spectacles spinning around with a book",
                      "reveal": "The whisperers are owls! It's their midnight book club. 'Shhh,' says the owl, smiling.", "sting": "thunder", "delay": 1800},
            "choices": [{"label": "Join story time 📖", "next": "end_owls"},
                        {"label": "Ask about the key 🗝️", "next": "end_key"}],
        },
        "ba": {
            "scene": f"{MILO} in a stone cellar full of glowing jars of preserves, shadows dancing on walls, one giant shadow of a monster cast on the far wall from something small behind a shelf",
            "text": "The cellar glows with a hundred little jars. But on the wall — a HUGE monster shadow rises!",
            "scare": {"spot": "the shelf casting the giant monster shadow", "pop": "a tiny proud mouse in a chef hat holding a candle, taking a bow",
                      "reveal": "The giant monster is... a tiny chef mouse and his candle! He offers Milo blackberry jam.", "sting": "thunder", "delay": 1900},
            "choices": [{"label": "Share the jam 🫙", "next": "end_feast"},
                        {"label": "Ask about the key 🗝️", "next": "end_key"}],
        },
        "bb": {
            "scene": f"{MILO} inside a moonlit greenhouse of silver plants, vines swaying with no wind, a tall shape draped in a white sheet standing among the pots",
            "text": "The greenhouse plants sway... but there is no wind. And that tall white shape was NOT there before.",
            "scare": {"spot": "the tall shape draped in a white sheet", "pop": "a tall friendly heron wearing the sheet like a cape, striking a heroic pose",
                      "reveal": "A heron in a bedsheet! 'I am the Garden Phantom!' she announces proudly. Nobody is scared.", "sting": "thunder", "delay": 1700},
            "choices": [{"label": "Cheer for the Phantom 🦸", "next": "end_phantom"},
                        {"label": "Ask about the key 🗝️", "next": "end_key"}],
        },
        "end_family": {
            "scene": f"{MILO} and a ghost-grey old cat in a nightcap having midnight tea by candlelight in the attic, warm and cozy, storm visible through window",
            "text": "Milo and Great-Grandcat share midnight tea and stories until the storm passes. The End!",
        },
        "end_key": {
            "scene": f"{MILO} walking out the front gate holding an ornate golden key glowing warmly, and in the lit window behind him a gentle shadowy figure waving goodbye",
            "text": "Milo found grandma's key! And as he leaves... something in the window waves goodbye. The End?",
        },
        "end_owls": {
            "scene": f"{MILO} curled among owls in tiny spectacles around a glowing storybook in the library, cozy candlelight",
            "text": "Milo stays for owl story time. The spooky house isn't spooky at all — just full of readers. The End!",
        },
        "end_feast": {
            "scene": f"{MILO} and a chef mouse feasting on jam and bread atop a barrel in the glowing cellar, jars lighting the scene like lanterns",
            "text": "A midnight jam feast with Chef Mouse! Milo's whiskers are purple with blackberry. The End!",
        },
        "end_phantom": {
            "scene": f"{MILO} marching in a proud little parade behind a heron wearing a bedsheet cape through the moonlit garden, hedgehogs following",
            "text": "The Garden Phantom leads a midnight parade, and Milo is the lantern-bearer. The End!",
        },
    },
}

SCARE_SCHOOL = {
    "id": "scareschool",
    "title": "Scare School",
    "character": MO,
    "ref": {
        "file": "scareschool_cast.png",
        "prompt": f"A group lineup portrait of {MO} standing shyly in front of {CAST}, all together in a school gym, every monster fully visible and distinct",
    },
    "nodes": {
        "start": {
            "scene": f"{MO} standing nervously at the huge monster-shaped front doors of Scare School, a spooky-fun castle school with crooked towers, monster students streaming in",
            "text": "It's Mo's first day at Scare School — where little monsters learn to be scary. Mo is NOT scary. Yet.",
            "scare": {"spot": "the mailbox shaped like a monster head", "pop": "Fangsley the skinny yellow monster who is mostly a giant toothy grin popping out with jazz hands",
                      "reveal": "RAAH! Hee hee! 'Thorry,' lisps Fangsley through his teeth. 'Firtht-day tradition!'", "sting": "boing", "delay": 0},
            "choices": [{"label": "Go to Scaring Class 🎓", "next": "a"},
                        {"label": "Explore the lunchroom 🍝", "next": "b"}],
        },
        "a": {
            "scene": f"{MO} at a school desk in a classroom where {CAST.split(', Fangsley')[0]}) writes 'BOO 101' gestures on a chalkboard, other little monsters practicing scary faces",
            "text": "In Scaring Class, everyone practices their scary face. Mo's scary face just looks... adorable. The supply closet wobbles.",
            "scare": {"spot": "the wobbling supply closet", "pop": "Blobbina the round jiggly pink blob monster with long eyelashes bouncing out mid-jiggle",
                      "reveal": "BLOB! Blobbina jiggles so hard everyone falls off their chairs laughing. 'Ten points!' says the Principal.", "sting": "boing", "delay": 0},
            "choices": [{"label": "Practice a tiny boo 😮", "next": "aa"},
                        {"label": "Ask Blobbina for tips 💗", "next": "ab"}],
        },
        "b": {
            "scene": f"{MO} in the monster lunchroom with floating trays of worm spaghetti and eyeball pudding, a lunch counter with a suspiciously grinning pot",
            "text": "Lunch is worm spaghetti and eyeball pudding (it's just grapes). Something under the lunch counter is giggling...",
            "scare": {"spot": "under the lunch counter", "pop": "Sir Stretch the tall blue monster unfolding his impossibly long noodle arms in every direction",
                      "reveal": "Sir Stretch was folded under there ALL MORNING waiting! 'Worth it,' he says, un-crumpling.", "sting": "boing", "delay": 0},
            "choices": [{"label": "Have a noodle-arm contest 💪", "next": "ba"},
                        {"label": "Sit with the Twins 🗣️", "next": "bb"}],
        },
        "aa": {
            "scene": f"{MO} on a small stage in the school gym at the Scary Talent Show, all the cast monsters in the audience, spotlight on Mo looking tiny and brave",
            "text": "The Scary Talent Show! Every monster did a big scare. Now it's Mo's turn. The gym goes silent... the curtain behind Mo ripples.",
            "scare": {"spot": "the rippling stage curtain", "pop": "the orange two-headed Twins monster tumbling through tangled in the curtain, both heads blaming each other",
                      "reveal": "The Twins fell through the curtain! 'YOUR fault!' 'YOUR fault!' The audience howls with laughter.", "sting": "boing", "delay": 0},
            "choices": [{"label": "Do the tiny boo now 🎤", "next": "end_boo"},
                        {"label": "Team up with the Twins 🤝", "next": "end_team"}],
        },
        "ab": {
            "scene": f"{MO} and Blobbina the pink blob monster practicing scares in front of funhouse mirrors, their reflections stretched hilariously",
            "text": "Blobbina's secret: 'Being scary is just being YOU, but louder.' The funhouse mirror behind them darkens...",
            "scare": {"spot": "the darkened funhouse mirror", "pop": "Principal Growlbert the huge shaggy purple monster with glasses stepping out of the mirror-dark holding a juice box",
                      "reveal": "It's just Principal Growlbert on juice break! His shadow is scarier than he is. 'Carry on!'", "sting": "boing", "delay": 0},
            "choices": [{"label": "Be Mo, but louder! 📣", "next": "end_boo"},
                        {"label": "Scare the Principal back 😈", "next": "end_growl"}],
        },
        "ba": {
            "scene": f"{MO} wrapped gently in Sir Stretch's noodle arms like a swing, being swung across the lunchroom while monsters cheer",
            "text": "Mo wins the noodle-arm contest by becoming the ball! But the pudding cart is rolling away by itself...",
            "scare": {"spot": "the runaway pudding cart", "pop": "Fangsley bursting out from inside the pudding cart covered in pudding, grinning wider than ever",
                      "reveal": "Fangsley was IN the pudding! 'Thith ith the betht day of my life,' he says, dripping.", "sting": "boing", "delay": 0},
            "choices": [{"label": "Pudding party! 🍮", "next": "end_pudding"},
                        {"label": "Clean up together 🧽", "next": "end_team"}],
        },
        "bb": {
            "scene": f"{MO} sitting between the two arguing heads of the orange Twins monster at lunch, both heads leaning toward Mo mid-argument",
            "text": "The Twins can't agree whose scare is best. They ask Mo to judge. Behind them, the trash can tiptoes away...",
            "scare": {"spot": "the tiptoeing trash can", "pop": "Blobbina lifting the trash can lid from inside like a helmet, striking a superhero pose",
                      "reveal": "Trash-can Blobbina! Both Twin heads agree for the FIRST TIME EVER: that was the best scare.", "sting": "boing", "delay": 0},
            "choices": [{"label": "Declare everyone winners 🏆", "next": "end_team"},
                        {"label": "Try the trash-can trick 🗑️", "next": "end_pudding"}],
        },
        "end_boo": {
            "scene": f"{MO} on the gym stage saying a tiny boo into a big microphone while every cast monster faints backward dramatically with happy faces, confetti falling",
            "text": "Mo whispers the tiniest 'boo' ever... and the whole school faints — from laughing! Scariest Sound trophy: MO! The End!",
        },
        "end_team": {
            "scene": f"{MO} and all the cast monsters taking a group bow on stage under a banner of scribbled monster drawings, arms and noodle-arms around each other",
            "text": "Scares are better together! Mo and the whole class take a bow. Best first day ever. The End!",
        },
        "end_growl": {
            "scene": f"Principal Growlbert the huge purple monster leaping in surprise spilling his juice box while tiny {MO} says boo behind him, teachers applauding",
            "text": "Mo scares the PRINCIPAL! Growlbert laughs so hard his glasses fog up. Instant legend. The End!",
        },
        "end_pudding": {
            "scene": f"{MO} and the cast monsters in a joyful pudding food-fight in the lunchroom, pudding everywhere, everyone laughing",
            "text": "The Great Pudding Party of Scare School! Even the lunch pot is laughing. The End!",
        },
    },
}
