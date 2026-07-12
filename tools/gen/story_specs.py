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
            "text": "Milo must fetch grandma's key from the old house on the hill. 'Miiiilo...' the wind whispers, curling round his ears. His whiskers shiver.",
            "scare": {"spot": "gnarled bush beside the gate", "pop": "a startled crow bursting upward with wings spread wide, feathers flying",
                      "reveal": "Just an old crow! It was sleeping in the bush. Keep going, Milo...", "sting": "thunder", "delay": 1600},
            "choices": [{"label": "Creep through the front door 🚪", "next": "a"},
                        {"label": "Sneak around the back 🌙", "next": "b"}],
        },
        "a": {
            "scene": f"{MILO} inside a dark grand hallway with a tall staircase, portraits with eyes in shadow, lantern casting long shadows, something small skittering at the edge of the light",
            "text": "The hallway is dark and TOO quiet. Scritch. Scritch. 'Wh-who's there?' Milo squeaks. Something in the closet knows he's here.",
            "scare": {"spot": "the tall closet door", "pop": "a shivering wet raccoon in a tiny raincoat mid-leap, eyes wide",
                      "reveal": "A soggy raccoon! 'Sorry,' he sniffles, 'I was cold.' He points upstairs with his tail.", "sting": "thunder", "delay": 1900},
            "choices": [{"label": "Climb the creaky stairs 🕯️", "next": "aa"},
                        {"label": "Follow the skittering sound 🐾", "next": "ab"}],
        },
        "b": {
            "scene": f"{MILO} in an overgrown moonlit back garden, crooked greenhouse, fog curling on the grass, a rusty cellar door slightly open with darkness below",
            "text": "In the garden, the fog moves like it's alive. The cellar door groans wide OPEN by itself. 'H-hello?' whispers Milo. Something breathes down there.",
            "scare": {"spot": "the dark open cellar door", "pop": "three tiny glowing-eyed hedgehogs stacked on each other wearing one long scarf, tumbling out",
                      "reveal": "Three hedgehogs in one scarf! They were hiding from the storm. The smallest one giggles.", "sting": "thunder", "delay": 1700},
            "choices": [{"label": "Go down into the cellar 🔦", "next": "ba"},
                        {"label": "Tiptoe to the greenhouse 🌿", "next": "bb"}],
        },
        "aa": {
            "scene": f"{MILO} at the top of the stairs in a dusty attic corridor, moonlight stripes through shutters, an old music box on a table glowing softly, a door at the end rattling",
            "text": "Upstairs, a music box plays all by itself... and the door at the end of the hall RATTLES. Then a soft voice purrs: 'Milo? Is that you, little one?' It's Great-Grandcat!",
            "scare": {"spot": "the rattling door at the end of the hall", "pop": "a joyful old ghost-grey cat in a nightcap bursting through with open arms",
                      "reveal": "It's Great-Grandcat Whiskers! 'Visitors! Finally!' he laughs. He knows where the key is...", "sting": "thunder", "delay": 2000},
            "choices": [{"label": "Hug Great-Grandcat 💜", "next": "end_family"},
                        {"label": "Ask about the key 🗝️", "next": "end_key"}],
        },
        "ab": {
            "scene": f"{MILO} in a grand dark library, books floating gently off shelves, a big armchair facing away with something's tail visible, whispering sounds all around",
            "text": "In the library the whispers are LOUD now. The big chair creaks. Something's tail twitches behind it... and a kind voice hoots: 'Who-o-o wants a story?'",
            "scare": {"spot": "the big armchair facing away", "pop": "a wide-eyed owl librarian in tiny spectacles spinning around with a book",
                      "reveal": "The whisperers are owls! It's their midnight book club. 'Shhh,' says the owl, smiling.", "sting": "thunder", "delay": 1800},
            "choices": [{"label": "Join story time 📖", "next": "end_owls"},
                        {"label": "Ask about the key 🗝️", "next": "end_key"}],
        },
        "ba": {
            "scene": f"{MILO} in a stone cellar full of glowing jars of preserves, shadows dancing on walls, one giant shadow of a monster cast on the far wall from something small behind a shelf",
            "text": "The cellar glows with a hundred jam jars. A HUGE monster shadow rises on the wall! But look closer — 'Bienvenue!' pipes a teeny mouse in a chef's hat, holding jam toast.",
            "scare": {"spot": "the shelf casting the giant monster shadow", "pop": "a tiny proud mouse in a chef hat holding a candle, taking a bow",
                      "reveal": "The giant monster is... a tiny chef mouse and his candle! He offers Milo blackberry jam.", "sting": "thunder", "delay": 1900},
            "choices": [{"label": "Share the jam 🫙", "next": "end_feast"},
                        {"label": "Ask about the key 🗝️", "next": "end_key"}],
        },
        "bb": {
            "scene": f"{MILO} inside a moonlit greenhouse of silver plants, vines swaying with no wind, a tall shape draped in a white sheet standing among the pots",
            "text": "The plants sway... but there is no wind. That tall white shape was NOT there before. 'Oooo-hee-hee!' giggles a friendly voice. Could it be... a Garden Phantom?",
            "scare": {"spot": "the tall shape draped in a white sheet", "pop": "a tall friendly heron wearing the sheet like a cape, striking a heroic pose",
                      "reveal": "A heron in a bedsheet! 'I am the Garden Phantom!' she announces proudly. Nobody is scared.", "sting": "thunder", "delay": 1700},
            "choices": [{"label": "Cheer for the Phantom 🦸", "next": "end_phantom"},
                        {"label": "Ask about the key 🗝️", "next": "end_key"}],
        },
        "end_family": {
            "scene": f"{MILO} and a ghost-grey old cat in a nightcap having midnight tea by candlelight in the attic, warm and cozy, storm visible through window",
            "text": "'Warms the whiskers, doesn't it?' purrs Great-Grandcat. They share midnight tea till the storm passes — and peeking from the teapot? Grandma's key! The End!",
        },
        "end_key": {
            "scene": f"{MILO} fumbling an ornate golden key at the front gate, the key mid-bounce toward a storm drain grate, his paws reaching too late, rain puddles everywhere",
            "text": "Milo asked so nicely — his new friend handed over the key! But Milo's paws were shaking and — CLINK-CLONK-SPLASH — right down the drain. 'I'll... come back tomorrow,' he squeaks. Oopsie ending!",
            "bad": True,
        },
        "end_owls": {
            "scene": f"{MILO} fast asleep drooling on an open book in the library, owls in tiny spectacles staring at him with disapproval, candles burned low",
            "text": "'Cozy up, kitten!' hoot the owls. The story is SO good that Milo falls fast asleep mid-chapter. He wakes at dawn drooling on a first edition. No key, zero clues, one very judgy owl. Oopsie ending!",
            "bad": True,
        },
        "end_feast": {
            "scene": f"{MILO} and a chef mouse feasting on jam and bread atop a barrel in the glowing cellar, jars lighting the scene like lanterns",
            "text": "'Mangez, mangez!' cheers Chef Mouse at a midnight jam feast. Milo's whiskers are strawberry-sticky — and Chef Mouse knows JUST where grandma's key is. The End!",
        },
        "end_phantom": {
            "scene": f"{MILO} marching in a proud little parade behind a heron wearing a bedsheet cape through the moonlit garden, hedgehogs following",
            "text": "'Follow the Phaaaantom!' the heron announces. She leads a midnight parade — hedgehogs in a line, Milo bearing the lantern — and look! Grandma's key in the flowers. The End!",
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
            "text": "'First day!' squeaks Mo. Scare School is where little monsters learn to be scary. But Mo is NOT scary. Yet.",
            "scare": {"spot": "the mailbox shaped like a monster head", "pop": "Fangsley the skinny yellow monster who is mostly a giant toothy grin popping out with jazz hands",
                      "reveal": "RAAH! Hee hee! 'Thorry,' lisps Fangsley through his teeth. 'Firtht-day tradition!'", "sting": "boing", "delay": 0},
            "choices": [{"label": "Go to Scaring Class 🎓", "next": "a"},
                        {"label": "Explore the lunchroom 🍝", "next": "b"}],
        },
        "a": {
            "scene": f"{MO} at a school desk in a classroom where {CAST.split(', Fangsley')[0]}) writes 'BOO 101' gestures on a chalkboard, other little monsters practicing scary faces",
            "text": "'BOO one-oh-one!' booms Principal Growlbert in Scaring Class. Mo's scary face just looks... adorable. The supply closet WOBBLES — someone tiny inside is giggling too!",
            "scare": {"spot": "the wobbling supply closet", "pop": "Blobbina the round jiggly pink blob monster with long eyelashes bouncing out mid-jiggle",
                      "reveal": "BLOB! Blobbina jiggles so hard everyone falls off their chairs laughing. 'Ten points!' says the Principal.", "sting": "boing", "delay": 0},
            "choices": [{"label": "Practice a tiny boo 😮", "next": "aa"},
                        {"label": "Ask Blobbina for tips 💗", "next": "ab"}],
        },
        "b": {
            "scene": f"{MO} in the monster lunchroom with floating trays of worm spaghetti and eyeball pudding, a lunch counter with a suspiciously grinning pot",
            "text": "'Worm spaghetti! Eyeball pudding!' announces the lunch pot. The eyeballs are just grapes, phew. Something under the counter is giggling...",
            "scare": {"spot": "under the lunch counter", "pop": "Sir Stretch the tall blue monster unfolding his impossibly long noodle arms in every direction",
                      "reveal": "Sir Stretch was folded under there ALL MORNING waiting! 'Worth it,' he says, un-crumpling.", "sting": "boing", "delay": 0},
            "choices": [{"label": "Have a noodle-arm contest 💪", "next": "ba"},
                        {"label": "Sit with the Twins 🗣️", "next": "bb"}],
        },
        "aa": {
            "scene": f"{MO} on a small stage in the school gym at the Scary Talent Show, all the cast monsters in the audience, spotlight on Mo looking tiny and brave",
            "text": "'And now — MO!' announces Principal Growlbert. Every monster did a big scare. The gym goes hush-silent... the curtain behind Mo ripples.",
            "scare": {"spot": "the rippling stage curtain", "pop": "the orange two-headed Twins monster tumbling through tangled in the curtain, both heads blaming each other",
                      "reveal": "The Twins fell through the curtain! 'YOUR fault!' 'YOUR fault!' The audience howls with laughter.", "sting": "boing", "delay": 0},
            "choices": [{"label": "Do the tiny boo now 🎤", "next": "end_boo"},
                        {"label": "Team up with the Twins 🤝", "next": "end_team"}],
        },
        "ab": {
            "scene": f"{MO} and Blobbina the pink blob monster practicing scares in front of funhouse mirrors, their reflections stretched hilariously",
            "text": "Blobbina pulls Mo down the hall. 'Being scary is just being YOU — your way!' she winks. The funhouse mirror behind them darkens...",
            "scare": {"spot": "the darkened funhouse mirror", "pop": "Principal Growlbert the huge shaggy purple monster with glasses stepping out of the mirror-dark holding a juice box",
                      "reveal": "It's just Principal Growlbert on juice break! His shadow is scarier than he is. 'Carry on!'", "sting": "boing", "delay": 0},
            "choices": [{"label": "Try the teeny-tiniest boo 🤫", "next": "end_boo"},
                        {"label": "Scare Principal Growlbert back 😈", "next": "end_growl"}],
        },
        "ba": {
            "scene": f"{MO} wrapped gently in Sir Stretch's noodle arms like a swing, being swung across the lunchroom while monsters cheer",
            "text": "'MO IS THE BALL!' cheers Sir Stretch, winning the noodle-arm contest. But the pudding cart is rolling away all by itself...",
            "scare": {"spot": "the runaway pudding cart", "pop": "Fangsley bursting out from inside the pudding cart covered in pudding, grinning wider than ever",
                      "reveal": "Fangsley was IN the pudding! 'Thith ith the betht day of my life,' he says, dripping.", "sting": "boing", "delay": 0},
            "choices": [{"label": "Pudding party! 🍮", "next": "end_pudding"},
                        {"label": "Clean up together 🧽", "next": "end_team"}],
        },
        "bb": {
            "scene": f"{MO} sitting between the two arguing heads of the orange Twins monster at lunch, both heads leaning toward Mo mid-argument",
            "text": "'MINE was scariest!' 'No, MINE!' The Twins won't stop. 'You judge, Mo!' they beg. Behind them, the trash can tiptoes away...",
            "scare": {"spot": "the tiptoeing trash can", "pop": "Blobbina lifting the trash can lid from inside like a helmet, striking a superhero pose",
                      "reveal": "Trash-can Blobbina! Both Twin heads agree for the FIRST TIME EVER: that was the best scare.", "sting": "boing", "delay": 0},
            "choices": [{"label": "Declare everyone winners 🏆", "next": "end_team"},
                        {"label": "Try the trash-can trick 🗑️", "next": "end_pudding"}],
        },
        "end_boo": {
            "scene": f"{MO} on the gym stage saying a tiny boo into a big microphone while every cast monster faints backward dramatically with happy faces, confetti falling",
            "text": "At the big talent show, Mo whispers the tiniest 'boo' ever... and the whole school tumbles over laughing! The giggly closet ghost giggles loudest of all. Scariest Sound winner: MO! The End!",
        },
        "end_team": {
            "scene": f"{MO} squished at the bottom of a monster pile-up on stage, {CAST} toppled like dominoes, arms and noodle-arms everywhere, everyone laughing",
            "text": "'Group bow!' cheers Principal Growlbert. Mo bows, bumps Blobbina, who jiggles into Sir Stretch, who tangles the Twins, who topple the Principal. One monster domino. Mo is squished at the bottom smiling. Oopsie ending!",
            "bad": True,
        },
        "end_growl": {
            "scene": f"Principal Growlbert the huge purple monster leaping in surprise spilling his juice box while tiny {MO} says boo behind him, teachers applauding",
            "text": "Mo sneaks up and — 'BOO!' Principal Growlbert leaps so high his juice flies! 'You got me!' he wheezes, glasses foggy with laughter. Instant legend! The End!",
        },
        "end_pudding": {
            "scene": f"{MO} sliding through a wave of pudding out the lunchroom door and into the school fountain, covered head to nub in pudding, Fangsley waving sorry from inside",
            "text": "CRASH! SPLAT! Mo slips in a pudding wave and skids all the way down the hall, out the front door, and into the school fountain. 'THORRY!' calls Fangsley from inside. Pudding in his eye. Pudding in his ear. Oopsie ending!",
            "bad": True,
        },
    },
}


# ---------------------------------------------------------------------------
# Hotspot-native books: choices live IN the scene. Every choice carries a
# `spot` (a SAM-locatable phrase for the drawn affordance) and the scene
# prompt composes BOTH affordances large, distinct, and clearly separated
# (left/right). The kid taps the door itself — no buttons.

RAINBOW_DOORS = {
    "id": "doors",
    "title": "The Two-Door House",
    "character": LUNA,
    "nodes": {
        "start": {
            "scene": f"{LUNA} standing in a flowery meadow before a small crooked floating cottage that has TWO front doors side by side: on the LEFT a round bright RED door with a big carved golden sun, on the RIGHT a tall arched deep BLUE door with a big carved silver moon. Both doors large, fully visible, clearly separated",
            "text": "'A tiny magic house!' Luna gasps. Two doors: the red sun door humming warm, the blue moon door twinkling with stars. Which will she open?",
            "choices": [{"label": "Open the red sun door", "next": "a", "spot": "round red door"},
                        {"label": "Open the blue moon door", "next": "b", "spot": "tall blue door"}],
        },
        "a": {
            "scene": f"{LUNA} stepping into a sunny garden in the clouds, golden light everywhere. On the LEFT a shiny GOLDEN spiral slide curling down from a cloud hill, on the RIGHT a giant RED-capped bouncy mushroom with white spots like a trampoline. Both large, fully visible, clearly separated",
            "text": "Behind the red door — a garden in the clouds! 'Boing... boing...' hums a giant mushroom-trampoline. A golden slide curls down the hill. Where to play?",
            "choices": [{"label": "Whoosh down the golden slide", "next": "aa", "spot": "golden spiral slide"},
                        {"label": "Bounce on the big mushroom", "next": "ab", "spot": "giant red mushroom"}],
        },
        "b": {
            "scene": f"{LUNA} stepping into a magical night garden under swirling stars. On the LEFT a little WOODEN boat glowing with fireflies floating on a starlit pond, on the RIGHT a SILVER crescent-moon swing hanging from a star on silver ropes. Both large, fully visible, clearly separated",
            "text": "Behind the blue door — a starry night garden! 'Ride us!' twinkle the fireflies from a little boat. A silver moon-swing sways from a star. What'll it be?",
            "choices": [{"label": "Sail the firefly boat", "next": "ba", "spot": "wooden boat"},
                        {"label": "Swing on the moon swing", "next": "bb", "spot": "silver moon swing"}],
        },
        "aa": {
            "scene": f"{LUNA} landing at the bottom of the golden slide in a valley of candy-colored clouds. On the LEFT a RAINBOW ferris wheel made of clouds turning slowly, on the RIGHT a cozy little cloud cottage with a puffing chimney and warm windows. Both large, fully visible, clearly separated",
            "text": "'WHEEEE!' The slide lands in a candy-cloud valley. A rainbow ferris wheel spins slowly; a cloud cottage puffs cozy smoke-rings. Where to now?",
            "choices": [{"label": "Ride the rainbow wheel", "next": "end_party", "spot": "rainbow ferris wheel"},
                        {"label": "Knock at the cloud cottage", "next": "end_cozy", "spot": "cloud cottage"}],
        },
        "ab": {
            "scene": f"{LUNA} bouncing high off the giant mushroom toward a treetop village at sunset. On the LEFT a long ROPE bridge with flags leading to a treehouse full of lanterns and party balloons, on the RIGHT a small FLUFFY white cloud with a friendly smiling face floating close by. Both large, fully visible, clearly separated",
            "text": "'BOOOING!' Luna bounces up to a treetop village. A flaggy bridge leads to a lantern party — and a smiling little cloud floats up. 'Hop on!' it whispers.",
            "choices": [{"label": "Cross the rope bridge", "next": "end_party_treetop", "spot": "rope bridge"},
                        {"label": "Hop on the friendly cloud", "next": "end_flight", "spot": "fluffy white cloud"}],
        },
        "ba": {
            "scene": f"{LUNA} in the glowing firefly boat arriving at a tiny island where baby stars sleep. On the LEFT a big soft NEST woven of moonbeams full of dozing glowing baby stars, on the RIGHT a small striped MOON lighthouse with a spiral staircase and a bright lamp. Both large, fully visible, clearly separated",
            "text": "The firefly boat sails to Star Island. 'Zzzz... twinkle... zzzz,' snore the baby stars in a moonbeam nest. A little striped lighthouse blinks. Where to?",
            "choices": [{"label": "Snuggle into the star nest", "next": "end_stars", "spot": "nest of baby stars"},
                        {"label": "Climb the little lighthouse", "next": "end_dizzy", "spot": "striped lighthouse"}],
        },
        "bb": {
            "scene": f"{LUNA} swinging up onto a moon balcony made of silver clouds. On the LEFT a big shiny BRASS telescope pointed at the twinkling sky, on the RIGHT a long curly SILVER slide spiraling from the balcony down toward a warm lit meadow far below. Both large, fully visible, clearly separated",
            "text": "The swing lifts Luna to a moon balcony! 'Peek through me!' hums a brass telescope. A curly silver slide swooshes all the way home. What'll Luna pick?",
            "choices": [{"label": "Peek through the telescope", "next": "end_stars_moon", "spot": "brass telescope"},
                        {"label": "Take the silver slide home", "next": "end_slip", "spot": "silver slide"}],
        },
        "end_dizzy": {
            "scene": "LUNA_DIZZY_PLACEHOLDER",
            "text": "'WHOA — bright!' Luna goes dizzy from the lighthouse lamp and slides right back to the boat. Home early, blinking little stars. Oopsie ending!",
            "bad": True,
        },
        "end_slip": {
            "scene": "LUNA_SLIP_PLACEHOLDER",
            "text": "'WHEEE — too FAST!' The silver slide plops Luna SPLAT into a puddle. 'Muddy mane!' she giggles. Straight home for a bath. Oopsie ending!",
            "bad": True,
        },
        "end_party_treetop": {
            "scene": f"{LUNA} dancing at a joyful treetop lantern party just across the rope bridge, treehouse village at sunset, paper lanterns and balloons everywhere, cloud sheep and star bunnies dancing along",
            "text": "Across the bridge — the treetop party is ON! 'Luna's here!' cheer the cloud sheep. Lanterns and dancing till the stars peep out. The End!",
        },
        "end_stars_moon": {
            "scene": f"{LUNA} at the big brass telescope on the silver moon balcony while glowing baby stars fly up and snuggle around her shoulders and rainbow mane, twinkling night sky",
            "text": "Through the telescope Luna spots... baby stars! 'Snuggle time!' they twinkle, flying up to cuddle her on the moon balcony. Goodnight, little stars. The End!",
        },
        "end_party": {
            "scene": f"{LUNA} dancing at a joyful cloud carnival with cloud sheep, star bunnies and rainbow birds, ferris wheel and lanterns glowing, confetti of flower petals",
            "text": "'Round and round!' cheers a cloud sheep as Luna spins on the rainbow wheel, then dances into the evening. Best. Door. Ever! The End!",
        },
        "end_cozy": {
            "scene": f"{LUNA} curled up by a crackling fireplace inside the cozy cloud cottage, sipping cocoa with marshmallows with a kindly old cloud sheep in spectacles",
            "text": "'One lump or two, dearie?' asks Granny Sheep. Cocoa, marshmallows, stories by the fire — Luna purrs like a kitten. The End!",
        },
        "end_stars": {
            "scene": f"{LUNA} asleep in the moonbeam nest with glowing baby stars snuggled all around her like a blanket, one baby star on her head",
            "text": "'Shhhh...' twinkle the baby stars, snuggling Luna like a sparkly blanket. Goodnight, little unicorn. The End!",
        },
        "end_flight": {
            "scene": f"{LUNA} flying home across a pink sunset sky on the back of the smiling fluffy cloud, her rainbow mane streaming, the little two-door house tiny below",
            "text": "The friendly cloud flies Luna all the way home, loop-de-loop! 'Same time tomorrow?' it whispers. The End!",
        },
    },
}

TREASURE_TRAIL = {
    "id": "trail",
    "title": "Pip's Treasure Trail",
    "character": PIP,
    "nodes": {
        "start": {
            "scene": f"{PIP} on a sunny beach holding a crinkly treasure map in his mouth. On the LEFT a dark mysterious CAVE mouth in a seaside cliff with glowing crystals inside, on the RIGHT a wobbly ROPE bridge with wooden planks crossing a turquoise lagoon toward a jungle. Both large, fully visible, clearly separated",
            "text": "'X marks the spot!' Pip yips at the map. The trail splits: a sparkly crystal cave, or a wobbly rope bridge over the lagoon. Which way?",
            "choices": [{"label": "Into the crystal cave", "next": "a", "spot": "dark cave mouth"},
                        {"label": "Across the rope bridge", "next": "b", "spot": "rope bridge"}],
        },
        "a": {
            "scene": f"{PIP} inside a glittering cave lit by friendly green glowworms. On the LEFT a tunnel whose walls sparkle with PURPLE and PINK crystals, on the RIGHT a little RED wooden row boat with oars resting on an underground stream. Both large, fully visible, clearly separated",
            "text": "'Blink hello!' twinkle the cave glowworms like tiny lanterns. A crystal tunnel sparkles pink and purple; a little red boat rocks on an underground stream. Which way?",
            "choices": [{"label": "Through the crystal tunnel", "next": "aa", "spot": "purple crystal tunnel"},
                        {"label": "Row the little red boat", "next": "ab", "spot": "red row boat"}],
        },
        "b": {
            "scene": f"{PIP} in a bright jungle clearing after the bridge. On the LEFT a very tall LOOKOUT palm tree with a rope ladder going up to a small wooden platform, on the RIGHT a thick green jungle VINE hanging like a swing over a mossy gully. Both large, fully visible, clearly separated",
            "text": "The jungle BUZZES green! 'Rrrribbit — up here!' calls a frog from the palm. A rope ladder climbs high, and a fat vine swings over the gully. Which way?",
            "choices": [{"label": "Climb the lookout palm", "next": "ba", "spot": "rope ladder"},
                        {"label": "Swing on the jungle vine", "next": "bb", "spot": "green jungle vine"}],
        },
        "aa": {
            "scene": f"{PIP} in a grand treasure chamber deep in the cave. On the LEFT a GOLDEN door with a big crab-shaped lock glowing softly, on the RIGHT a shimmering WATERFALL curtain hiding something sparkly behind it. Both large, fully visible, clearly separated",
            "text": "'Whoa — a secret chamber!' Pip gasps. A golden door with a crab-shaped lock hums warm. A shimmery waterfall hides something sparkly. Where's the treasure?",
            "choices": [{"label": "Open the golden crab door", "next": "end_chest_cave", "spot": "golden door"},
                        {"label": "Peek behind the waterfall", "next": "end_soggy", "spot": "waterfall"}],
        },
        "ab": {
            "scene": f"{PIP} rowing the little red boat across a huge underground lagoon glowing blue. On the LEFT a tiny striped LIGHTHOUSE on a rock with a warm lamp and a waving crab beside it, on the RIGHT a burbling BUBBLE geyser making giant rainbow bubbles rise from the water. Both large, fully visible, clearly separated",
            "text": "The stream opens onto a glowing lagoon! 'Ahoy, pup!' waves a crab from a tiny lighthouse. Over there, a geyser burps GIANT rainbow bubbles. Where to?",
            "choices": [{"label": "Visit the lighthouse crab", "next": "end_friends", "spot": "striped lighthouse"},
                        {"label": "Chase the rainbow bubbles", "next": "end_splash", "spot": "bubble geyser"}],
        },
        "ba": {
            "scene": f"{PIP} on the palm-top lookout platform seeing the whole island. On the LEFT a ZIPLINE with a wooden handle running down toward an old friendly shipwreck on the beach, on the RIGHT a springy COCONUT catapult made of bent palm and vines loaded with one coconut. Both large, fully visible, clearly separated",
            "text": "'I can see EVERYTHING!' Pip barks from the treetop. An old shipwreck on the beach! A zipline zooms right to it. And... a coconut catapult? Choose, Pip!",
            "choices": [{"label": "Ride the zipline", "next": "end_chest_wreck", "spot": "zipline"},
                        {"label": "Boing the coconut catapult", "next": "end_boing", "spot": "coconut catapult"}],
        },
        "bb": {
            "scene": f"{PIP} landing with a soft thump on the deck of a friendly old shipwreck. On the LEFT the captain's big round SHIP WHEEL with a paw-print carved in the middle, on the RIGHT a colorful PARROT on a perch wearing a tiny pirate hat, squawking happily. Both large, fully visible, clearly separated",
            "text": "Wheee! Pip lands on a real pirate ship! The captain's wheel has a paw print on it... and a parrot in a tiny hat squawks 'Pieces of kibble! Pieces of kibble!' Who should Pip see?",
            "choices": [{"label": "Spin the captain's wheel", "next": "end_chest_wreck", "spot": "ship wheel"},
                        {"label": "Say hi to the parrot", "next": "end_friends", "spot": "parrot"}],
        },
        "end_soggy": {
            "scene": "PIP_SOGGY_PLACEHOLDER",
            "text": "SPLOOSH! 'Justtt more water!' sputters Pip. He's soaked to the whiskers, map all drippy. Home for a warm towel. Oopsie ending!",
            "bad": True,
        },
        "end_boing": {
            "scene": "PIP_BOING_PLACEHOLDER",
            "text": "BOOOING! 'AAAAA!' Pip flies aaaall the way back to the start of the beach. Sandy bottom, zero treasure. Oopsie ending!",
            "bad": True,
        },
        "end_chest_cave": {
            "scene": f"{PIP} in a glittering cave treasure chamber, the golden crab-lock door swung wide open behind him, opening a huge treasure chest overflowing with golden dog bones, shiny balls and squeaky toys, crystal light sparkling everywhere",
            "text": "The crab door creaks open — 'WOOF!' A chest of golden bones and squeaky toys, deep in the sparkly cave. X marks the spot! The End!",
        },
        "end_chest_wreck": {
            "scene": f"{PIP} on the deck of the friendly old shipwreck, an opened treasure chest overflowing with golden dog bones and squeaky toys beside the captain's wheel, the parrot in a tiny pirate hat cheering, turquoise sea behind",
            "text": "'X marks the SHIP!' cheers the parrot. Right there — the treasure chest! Golden bones, squeaky toys, deck full of joy. The End!",
        },
        "end_splash": {
            "scene": f"{PIP} splashing joyfully in the turquoise lagoon with a crab, a parrot and rainbow bubbles everywhere, treasure map floating like a little boat",
            "text": "SPLASH! 'Best. Swim. EVER!' woofs Pip with the crab. Bubbles and new friends — maybe THIS was the real treasure. Well... close enough! The End!",
        },
        "end_friends": {
            "scene": f"{PIP} at a beach picnic at sunset with a crab in a chef hat, a parrot in a pirate hat and a gentle whale peeking from the water, sharing sandwiches on a checkered blanket",
            "text": "'Sandwiches all round!' snips Crab. Parrot tells pirate jokes; Whale sprays a rainbow hello. Treasure friends forever! The End!",
        },
    },
}


# ---------------------------------------------------------------------------
# New hotspot books (2026-07): raised bar — WANT + obstacle on page 1,
# 4-decision-deep paths, shared mid-hubs (branch stays location-coherent
# because both parents come from the same side of the tree), per-branch
# callbacks paid off at the mids, one clever twist per book.

NIGHT_MARKET_STYLE = (
    "Warm night-market children's picture-book illustration: paper "
    "lanterns glowing gold and red, deep indigo sky, cozy shadows, "
    "steam rising from stalls, cobblestone streets. Landscape "
    "orientation. No text, no letters, no watermark, no people."
)

NIGHT_MARKET = {
    "id": "night",
    "title": "The Night Market Mystery",
    "character": MILO,
    "style": NIGHT_MARKET_STYLE,
    "nodes": {
        "start": {
            "scene": f"{MILO} at his grandma's empty market stall in a bustling glowing night market, sticky dango-glaze paw prints leading two ways from the empty melon crate. On the LEFT a bright RED torii gate opening onto a dark fishy alley of crates, on the RIGHT a bright PINK paper-lantern arch opening onto a jasmine-scented sweet lane. Both large, fully visible, clearly separated",
            "text": "'STOLEN!' cries Milo. Grandma's prize melon is GONE — and dawn is only ten lanterns away! The thief left dango paw prints heading two ways. Which way, Detective?",
            "choices": [{"label": "Take the fishy alley", "next": "a", "spot": "red torii gate"},
                        {"label": "Take the sweet lane", "next": "b", "spot": "pink lantern arch"}],
        },
        "a": {
            "scene": f"{MILO} in a moonlit fish alley beside a snoring old fishmonger crumpled asleep across crates, a lucky mackerel-scale charm on the stall counter. On the LEFT a tall stack of GREEN net baskets pinned like a ladder against a wall, on the RIGHT a fat WOODEN pickle barrel with the lid tilted open and paw prints on the rim. Both large, fully visible, clearly separated",
            "text": "The fish-seller snores. 'Dragons love these,' Milo whispers, pocketing a lucky fish-scale charm. Bring it back later. Up the nets to the roof, or into the pickle barrel?",
            "choices": [{"label": "Climb the net baskets", "next": "aa", "spot": "green net baskets"},
                        {"label": "Into the pickle barrel", "next": "ab", "spot": "wooden pickle barrel"}],
        },
        "b": {
            "scene": f"{MILO} in the glowing lantern square feeding his last dumpling to a hungry black market CROW that caws happily, dango trail forking. On the LEFT a moonlit JADE garden gate framing glowing jasmine, on the RIGHT a red MOCHI shop archway hung with round pink and white sweets. Both large, fully visible, clearly separated",
            "text": "In the square, a hungry crow eyes Milo's last dumpling. 'Have it, friend.' 'CAW — thank you!' The trail forks: jasmine garden, or mochi lane?",
            "choices": [{"label": "Sneak into the jasmine garden", "next": "ba", "spot": "jade garden gate"},
                        {"label": "Run down the mochi lane", "next": "bb", "spot": "red mochi arch"}],
        },
        "aa": {
            "scene": f"{MILO} crouched on a moonlit tiled rooftop among sleeping market cats, the melon trail smudged toward two places. On the LEFT the tall BLUE bell tower rising over the market with a rope ladder dangling, on the RIGHT a curling column of STEAM from a wooden BATHHOUSE vent between the tiles. Both large, fully visible, clearly separated",
            "text": "'Mrow?' Rooftop cats blink hi. The trail smudges two ways: up the blue bell tower rope, or down through the bathhouse steam-vent?",
            "choices": [{"label": "Climb the bell tower", "next": "m1", "spot": "blue bell tower"},
                        {"label": "Slip through the vent", "next": "m2", "spot": "wooden bathhouse vent"}],
        },
        "ab": {
            "scene": f"{MILO} inside a dim pickle warehouse of enormous barrels, glow-fish in jars lighting the shelves. On the LEFT a big BRASS bell-cart stacked with barrels marked TEMPLE, on the RIGHT a low round WOODEN service door with a bathhouse steam-cloud carved above it. Both large, fully visible, clearly separated",
            "text": "Barrels TOWER up. 'Blup, blup,' glow-fish jars light the way. Two ways out: the brass bell-cart bound for the temple, or the little wooden door?",
            "choices": [{"label": "Hop on the bell cart", "next": "m1", "spot": "brass bell cart"},
                        {"label": "Slip through the door", "next": "m2", "spot": "wooden bathhouse door"}],
        },
        "ba": {
            "scene": f"{MILO} in a moonlit jasmine garden of glowing white flowers, fireflies drifting, the friendly crow following overhead. On the LEFT a wide RED lacquered courtyard bridge lit by lanterns, on the RIGHT a curved WOODEN koi-pond bridge leading toward glinting wharf water. Both large, fully visible, clearly separated",
            "text": "The jasmine garden hushes to a whisper. 'Sniff — sweet!' Milo breathes. Fireflies drift by like tiny lanterns. Red courtyard bridge, or koi bridge toward the wharf?",
            "choices": [{"label": "Cross the red bridge", "next": "m3", "spot": "red lacquered bridge"},
                        {"label": "Cross the koi bridge", "next": "m4", "spot": "wooden koi bridge"}],
        },
        "bb": {
            "scene": f"{MILO} in a sweet mochi lane of round pink and white shops, dango trail thick as jam, the crow perched cheerfully on a shopfront. On the LEFT a big PURPLE curtain drawn across a courtyard theatre with a mochi cart parked outside, on the RIGHT a rolling YELLOW honey-cart rumbling downhill toward the wharf. Both large, fully visible, clearly separated",
            "text": "The dango trail THICKENS — the crow lands. 'Caw — here, here!' she points. Slip under the big purple stage curtain, or hop the honey-cart toward the docks?",
            "choices": [{"label": "Slip under the curtain", "next": "m3", "spot": "purple theatre curtain"},
                        {"label": "Hop the honey cart", "next": "m4", "spot": "yellow honey cart"}],
        },
        "m1": {
            "scene": f"{MILO} on the top platform of the blue bell tower under a huge bronze bell, moonlight everywhere. On the LEFT a tiny sleeping BABY DRAGON curled around a green melon breathing sparkles, on the RIGHT a dusty rope room with a stack of GOLDEN bell weights and a startled mouse in a chef hat. Both large, fully visible, clearly separated",
            "text": "The tower! There's the melon — with a tiny snoring DRAGON cheek-to-rind against it. 'Awww,' Milo squeaks. Show the mackerel charm, or peek at the golden bell weights?",
            "choices": [{"label": "Show the mackerel charm", "next": "end_bell_dragon", "spot": "sleeping baby dragon"},
                        {"label": "Peek at the bell weights", "next": "end_bell_bounce", "spot": "golden bell weights"}],
        },
        "m2": {
            "scene": f"{MILO} on the wooden bathhouse walkway in warm steam, the melon just visible bobbing in the hot spring. On the LEFT the big STEAMY hot pool with a friendly fox spirit gently petting a green melon, on the RIGHT a slippery WHITE tiled floor beside a huge open dark SOY sauce barrel. Both large, fully visible, clearly separated",
            "text": "Steam curls. There's the melon — bobbing beside a friendly fox spirit! 'Ohhh, a guessst,' the fox purrs sly-and-velvety. Charm-and-bow, or skid across wet tiles?",
            "choices": [{"label": "Bow at the pool", "next": "end_bath_soak", "spot": "steamy hot pool"},
                        {"label": "Skid across tiles", "next": "end_soy_barrel", "spot": "white slippery tiles"}],
        },
        "m3": {
            "scene": f"{MILO} arriving at a moonlit courtyard stage, the CROW landing on his shoulder. In the middle, a small BABY DRAGON caught red-clawed hugging the green melon like an egg, blinking. On the LEFT a heap of GOLD confetti-cannons rigged for the moon festival, on the RIGHT a small STONE dragon shrine with a friendly stone-dragon face. Both large, fully visible, clearly separated",
            "text": "'GOTCHA!' A baby dragon hugs the melon like her missing egg. 'Egg?' she blinks. The crow lands helpfully. Pop the gold confetti, or take her to the stone dragon shrine?",
            "choices": [{"label": "Pop the confetti", "next": "end_court_confetti", "spot": "gold confetti cannons"},
                        {"label": "Take her to the shrine", "next": "end_court_reveal", "spot": "stone dragon shrine"}],
        },
        "m4": {
            "scene": f"{MILO} on the wharf under strings of lanterns, the CROW circling above. In the water, the green melon floats past on a leaf-boat paddled by a plump river OTTER. On the LEFT a small ORANGE rowboat tied at the pier with an oar ready, on the RIGHT a big RED koi splashing over a wet plank right beside Milo's paws. Both large, fully visible, clearly separated",
            "text": "The melon is FLOATING — an otter paddles off in a leaf-boat, melon bobbing behind! 'Caw, LEFT!' shouts the crow. Row the orange boat, or leap the splashy red koi shortcut?",
            "choices": [{"label": "Row the orange boat", "next": "end_wharf_otter", "spot": "orange row boat"},
                        {"label": "Leap onto the splashy koi", "next": "end_koi_splash", "spot": "big red koi"}],
        },
        "end_bell_dragon": {
            "scene": f"{MILO} on the moonlit bell-tower platform, mackerel charm in his paw, a tiny sparkling BABY DRAGON gently placing the green melon into a padded basket while the bronze bell chimes softly, dawn glow beginning",
            "text": "The charm calms her! The dragon-child gives the melon back — 'Sorry, I thought it was my egg!' Dawn bell chimes. Case closed! The End!",
        },
        "end_bell_bounce": {
            "scene": f"{MILO} in the bell-tower rope room rubbing his tail as GOLDEN bell weights roll everywhere, the green melon bouncing off the tower ledge into the distance, dawn light through the shutter",
            "text": "The weights TUMBLE — BONK BONK BONK — right onto Milo's tail! The melon rolls off the tower ledge and bounces all the way back to the market below. 'That... was my foot,' squeaks Milo. Grandma finds the melon before he does. Oopsie ending!",
            "bad": True,
        },
        "end_bath_soak": {
            "scene": f"{MILO} bowing beside a friendly FOX SPIRIT at the steamy bathhouse hot spring, the green melon floating between them like a bath toy, mackerel charm glowing softly on the ledge, dawn light",
            "text": "The fox spirit smiles: 'I only wanted to keep it warm — melon soup is best warm!' She hands it over with a wink. Case closed! The End!",
        },
        "end_soy_barrel": {
            "scene": f"{MILO} covered head to whiskers in dark SOY SAUCE splashing from a giant open soy barrel in the bathhouse, wide-eyed startled cats above, no melon in sight",
            "text": "SKIDDDD — SPLOOOOSH! Milo dives straight into the soy barrel. 'Salty whiskers,' he sighs, no melon in sight. Grandma cheers him up with pickles. Oopsie ending!",
            "bad": True,
        },
        "end_court_reveal": {
            "scene": f"{MILO} at the stone dragon shrine handing the green melon to a small BABY DRAGON as the stone dragon statue lights up glowing, the market CROW perched on Milo's shoulder, dawn glow",
            "text": "The stone dragon GLOWS — 'Your sibling waits inside!' A real dragon egg! Melon home, baby dragon beaming. Case closed! The End!",
        },
        "end_court_confetti": {
            "scene": f"{MILO} in a burst of GOLD confetti on the moonlit courtyard stage, a joyful BABY DRAGON handing over the green melon, the market CROW flying overhead pulling ribbons, the whole market waking to cheer",
            "text": "BOOM — gold confetti! The whole night market wakes up cheering. The dragon-child gives the melon back and asks to help sell them next week. Case closed! The End!",
        },
        "end_wharf_otter": {
            "scene": f"{MILO} in the little orange rowboat under wharf lanterns beside a plump river OTTER, both grinning as they lift the green melon out of a leaf-boat together at dawn",
            "text": "The otter mistook the melon for a floating snack — an easy mistake! Milo trades half a fish-cracker for it. Melon home in time for grandma's opening, and the crow sings them all the way there. Case closed! The End!",
        },
        "end_koi_splash": {
            "scene": f"{MILO} splashing SPLAT into the koi pond at the wharf, a big red KOI leaping above with a triumphant look, the melon leaf-boat drifting far off toward the dawn horizon",
            "text": "The koi flips — SPLASH! Milo becomes a very wet detective, and the melon bobs away down the river. The crow laughs from the lantern rope, and grandma laughs hardest of all. Oopsie ending!",
            "bad": True,
        },
    },
}


DEEP_SEA_STYLE = (
    "Bioluminescent deep-sea children's picture-book illustration: "
    "cool teal and violet water, glowing corals, drifting bubbles, "
    "soft ocean light, curling seaweed, gentle currents. Landscape "
    "orientation. No text, no letters, no watermark, no people."
)

DEEP_SEA = {
    "id": "deep",
    "title": "Mo and the Baby Glowfish",
    "character": MO,
    "style": DEEP_SEA_STYLE,
    "nodes": {
        "start": {
            "scene": f"{MO} bobbing at a starlit tide pool holding a glowing shell-lantern, a tiny trail of glowing bubbles leading off into the sea two ways. On the LEFT a swaying dark GREEN kelp forest with fish darting between fronds, on the RIGHT a bright PINK coral arch buzzing with rainbow fish. Both large, fully visible, clearly separated",
            "text": "A baby glowfish wandered from its tide-pool home! Mo lifts the shell-lantern — a bubble trail forks two ways. We have to get her home before the sun comes up! Kelp forest, or coral reef?",
            "choices": [{"label": "Swim into the kelp", "next": "a", "spot": "green kelp forest"},
                        {"label": "Swim to the coral", "next": "b", "spot": "pink coral arch"}],
        },
        "a": {
            "scene": f"{MO} inside a dim green kelp forest lit by his shell-lantern and a friendly tiny GLOWWORM riding on his nub. On the LEFT a narrow PINK ANEMONE gully bristling with soft glowing anemones, on the RIGHT a huge TAN GIANT clam propped open with a shimmering pearl inside. Both large, fully visible, clearly separated",
            "text": "A little glowworm friend hitches a ride — 'I'll light your way!' Two paths: down the pink anemone gully, or up to the giant clam's pearl light?",
            "choices": [{"label": "Down the gully", "next": "aa", "spot": "pink anemone gully"},
                        {"label": "To the giant clam", "next": "ab", "spot": "tan giant clam"}],
        },
        "b": {
            "scene": f"{MO} on the rainbow coral reef beside a hermit CRAB pouting over an empty shell, receiving a small CORAL HORN for a shiny pebble he traded. On the LEFT a bright ORANGE pufferfish tunnel of round puffed cheeks, on the RIGHT a big GREEN sea turtle drifting close, saddle-shell ready. Both large, fully visible, clearly separated",
            "text": "A sad hermit crab! Mo trades a shiny pebble and — 'A coral horn! Toot for help!' Two paths: the orange pufferfish tunnel, or hop on the sea turtle?",
            "choices": [{"label": "Through the tunnel", "next": "ba", "spot": "orange pufferfish tunnel"},
                        {"label": "Ride the sea turtle", "next": "bb", "spot": "green sea turtle"}],
        },
        "aa": {
            "scene": f"{MO} at the far end of the anemone gully, glowworm bright on his nub. On the LEFT a DARK KELP cave mouth glowing softly from within, on the RIGHT a huge WHITE WHALE skeleton arched over the sand like a natural gate. Both large, fully visible, clearly separated",
            "text": "The gully opens onto TWO wonders. A soft glow from deep in a kelp cave — or the arch of a whale's white bones humming like a wind chime?",
            "choices": [{"label": "Enter the kelp cave", "next": "m1", "spot": "dark kelp cave"},
                        {"label": "Under the whale bones", "next": "m2", "spot": "white whale skeleton"}],
        },
        "ab": {
            "scene": f"{MO} up beside the giant clam's pearl, glowworm bright. On the LEFT a mossy GREEN sunken door in the seafloor with a glowing seaweed wreath around it, on the RIGHT a colossal WHITE WHALE rib jutting from the sand pointing the way. Both large, fully visible, clearly separated",
            "text": "The clam-pearl lights the whole seafloor! Two ways: through a mossy green door into the kelp cave, or under the white whale rib?",
            "choices": [{"label": "Through the green door", "next": "m1", "spot": "green mossy door"},
                        {"label": "Under the whale rib", "next": "m2", "spot": "white whale rib"}],
        },
        "ba": {
            "scene": f"{MO} floating out of the pufferfish tunnel into open water, coral horn tied to his side. On the LEFT a shimmering PINK JELLY grove of glowing jellyfish drifting like paper lanterns, on the RIGHT a tall PURPLE CORAL castle with turrets rising over the reef. Both large, fully visible, clearly separated",
            "text": "Out the tunnel — WONDER! On one side a jelly grove glows like paper lanterns. On the other, a purple coral castle with pointy towers. Which way?",
            "choices": [{"label": "Into the jelly grove", "next": "m3", "spot": "pink jelly grove"},
                        {"label": "To the coral castle", "next": "m4", "spot": "purple coral castle"}],
        },
        "bb": {
            "scene": f"{MO} on the back of a GREEN sea turtle drifting past two sights, coral horn tied to his side. On the LEFT a huge floating BLUE JELLY crown pulsing softly near a grove, on the RIGHT a wide PURPLE CORAL gate with turrets rising behind. Both large, fully visible, clearly separated",
            "text": "The turtle glides past two sights. A giant blue jelly-crown pulses near the grove; a big purple coral gate leads to a castle. 'You pick, Mo!' says the turtle.",
            "choices": [{"label": "To the jelly crown", "next": "m3", "spot": "blue jelly crown"},
                        {"label": "Through the coral gate", "next": "m4", "spot": "purple coral gate"}],
        },
        "m1": {
            "scene": f"{MO} inside a glowing kelp cave, glowworm shining bright on his nub. In the middle, a shy BABY ANGLERFISH curled up mistaking Mo's lantern for the moon. On the LEFT a bright soft NEST of GLOWING plants where the anglerfish rests, on the RIGHT a friendly LANTERN CRAB waving a bright lantern claw. Both large, fully visible, clearly separated",
            "text": "In the cave — a baby ANGLERFISH, not a glowfish! She thought Mo's lantern was the moon. Glowworm agrees: 'Guide her home!' Snuggle her to the glow-nest, or wave the lantern crab over?",
            "choices": [{"label": "To the glow nest", "next": "end_cave_reveal", "spot": "glowing plant nest"},
                        {"label": "Wave the lantern crab", "next": "end_lantern_crab", "spot": "friendly lantern crab"}],
        },
        "m2": {
            "scene": f"{MO} under the great white whale skeleton, moonbeams filtering through. Inside the ribs, a soft glowing BABY ANGLERFISH tangled in old fishing net. On the LEFT a shimmering GHOSTLY BLUE whale spirit singing a lullaby in the water, on the RIGHT a knotted grey OLD FISHING net drifting in the current. Both large, fully visible, clearly separated",
            "text": "Under the whale ribs — it's a baby ANGLERFISH, not a glowfish! And she's stuck in a net! The whale-ghost hums a lullaby. Even the bubbles hush. Sing along to loosen the knots, or tug the tangled net free?",
            "choices": [{"label": "Sing the lullaby", "next": "end_whale_song", "spot": "ghostly blue whale"},
                        {"label": "Yank the fishing net", "next": "end_whale_snag", "spot": "old fishing net"}],
        },
        "m3": {
            "scene": f"{MO} floating into the jelly grove with the coral horn ready. Between glowing jellies, a shy BABY ANGLERFISH curls up beside a giant mother jelly. On the LEFT a BIG PINK jellyfish reaching out gentle glowing tentacles, on the RIGHT a spinning SILVER SNAIL carousel of round shells bouncing jellies gently. Both large, fully visible, clearly separated",
            "text": "There she is — a baby ANGLERFISH, thinking a mother jelly is a friendly moon! Toot the coral horn and float her home in pink jelly-arms, or take the wobbly snail carousel?",
            "choices": [{"label": "Toot for the jelly", "next": "end_jelly_hug", "spot": "big pink jellyfish"},
                        {"label": "Hop the snail carousel", "next": "end_jelly_bounce", "spot": "silver snail carousel"}],
        },
        "m4": {
            "scene": f"{MO} at the door of the coral castle. Inside, a coral KING holds a shy BABY ANGLERFISH like a tiny lost jewel. On the LEFT a GOLDEN PEARL table where the king polishes a found pearl, on the RIGHT a big SILVER DANCE floor pulsing with music as sea creatures twirl. Both large, fully visible, clearly separated",
            "text": "The coral king holds her — a baby ANGLERFISH, not a jewel! She thought the castle windows were the moon! Toot the coral horn at the golden pearl table, or join the silver dance and let the beat call her home?",
            "choices": [{"label": "Ask at the table", "next": "end_castle_pearl", "spot": "golden pearl table"},
                        {"label": "Join the dance", "next": "end_castle_dance", "spot": "silver dance floor"}],
        },
        "end_cave_reveal": {
            "scene": f"{MO} tucking a tiny BABY ANGLERFISH into a bright soft NEST of glowing plants deep in the kelp cave, glowworm perched on his nub as a nightlight, mother anglerfish returning with a smile, warm bioluminescent glow",
            "text": "'She's an anglerfish, not a glowfish!' Mo whispers. Mother anglerfish returns and kisses them both. Glowworm winks — 'Told you my light was best!' The End!",
        },
        "end_lantern_crab": {
            "scene": f"{MO} outside the kelp cave watching a friendly LANTERN CRAB guide a tiny BABY ANGLERFISH along the seafloor by bright claw-light, glowworm riding on Mo's nub, kelp swaying",
            "text": "The lantern crab waves — 'Follow me!' — and lights the baby's way home along the sand. Even glowworm gets a piggyback. Kelp-forest tucks them in. The End!",
        },
        "end_whale_song": {
            "scene": f"{MO} inside the whale-rib arch, a ghostly BLUE WHALE singing softly as the fishing net floats free and a tiny BABY ANGLERFISH swims right into Mo's paws, glowworm cheering, moonlit water",
            "text": "The whale's lullaby loosens the knots — the baby anglerfish drifts free right into Mo's paws. 'Sing us home?' Mo asks. The whale-song does. The End!",
        },
        "end_whale_snag": {
            "scene": f"{MO} tangled comically upside-down in the OLD FISHING net floating under the whale ribs, seaweed hat askew, the BABY ANGLERFISH poking a fin at his cheek with concern, glowworm rolling laughing",
            "text": "TUG! The net tangles MO instead. He floats upside-down like a confused jellyfish. Baby anglerfish taps his cheek. Whale-ghost bumps them both home. Oopsie ending!",
            "bad": True,
        },
        "end_jelly_hug": {
            "scene": f"{MO} being gently lifted by a BIG PINK jellyfish with a tiny BABY ANGLERFISH curled at his belly, jelly-grove glowing all around, coral horn tucked away, mother jelly smiling",
            "text": "TOOT — the jelly grove blooms! The mother-jelly cradles them both and floats them gently home to the tide pool. Softest ride ever. The End!",
        },
        "end_jelly_bounce": {
            "scene": f"{MO} bouncing haphazardly across silvery SNAIL shells like trampolines in the jelly grove, coral horn honking accidentally, BABY ANGLERFISH clinging to his ear, bubbles everywhere",
            "text": "BOING! BOING! The snail carousel is not for beginners. Mo pinballs through the grove, coral horn honking. Home... eventually. Salt-nose and giggles. Oopsie ending!",
            "bad": True,
        },
        "end_castle_pearl": {
            "scene": f"{MO} at the golden PEARL TABLE in the coral castle receiving a tiny glowing BABY ANGLERFISH from a smiling coral king, courtiers of rainbow fish bowing gently, coral horn on the table",
            "text": "TOOT — the coral horn! The king bows: 'Ah, our little visitor!' He returns the baby anglerfish on a velvet cushion. Royal escort home. The End!",
        },
        "end_castle_dance": {
            "scene": f"{MO} spinning dizzily on the SILVER DANCE floor of the coral castle, eyes spiralling, BABY ANGLERFISH clinging to his nub, rainbow fish watching with concern, coral horn floating away",
            "text": "The beat drops! Mo spins so fast he turns into a little green whirlpool. Baby anglerfish clings to his nub screaming with joy, but Mo has ZERO idea which way is home. The royal guard escorts a very dizzy detective back to the tide pool. Oopsie ending!",
            "bad": True,
        },
    },
}


SKY_RACE_STYLE = (
    "Bright morning sky children's picture-book illustration: pastel "
    "clouds like cotton candy, colorful hot-air balloons, soft blue "
    "sky, drifting streamers, warm sunrise light, cheerful and airy. "
    "Landscape orientation. No text, no letters, no watermark, no "
    "people."
)

SKY_RACE = {
    "id": "sky",
    "title": "Pip's Balloon Race",
    "character": PIP,
    "style": SKY_RACE_STYLE,
    "nodes": {
        "start": {
            "scene": f"{PIP} in a patchwork red-and-yellow hot-air balloon at a bright sunrise starting line, race flags waving. On the LEFT a puffy WHITE cloud tunnel curling through the sky like a smoke-ring, on the RIGHT a wide RAINBOW BRIDGE arcing between fluffy cloud platforms. Both large, fully visible, clearly separated",
            "text": "Pip's in the balloon race! First across the bakery finish wins the giant Cupcake Cup for Auntie Toast. Two shortcuts: the fast cloud tunnel, or the pretty rainbow bridge?",
            "choices": [{"label": "Into the cloud tunnel", "next": "a", "spot": "white cloud tunnel"},
                        {"label": "Over the rainbow bridge", "next": "b", "spot": "rainbow bridge"}],
        },
        "a": {
            "scene": f"{PIP} in his balloon inside the puffy cloud tunnel, a friendly CLOUD SHEEP handing him a tiny golden WIND-CHARM. On the LEFT a swirling GREEN windmill hill rising through the clouds, on the RIGHT a giant RED rainbow arch made of ribbons overhead. Both large, fully visible, clearly separated",
            "text": "A cloud sheep hands Pip a golden wind-charm — 'For big windy sky!' Two ways forward: over the green windmill hill, or under the red rainbow arch?",
            "choices": [{"label": "Over the windmill hill", "next": "aa", "spot": "green windmill hill"},
                        {"label": "Under the rainbow arch", "next": "ab", "spot": "red rainbow arch"}],
        },
        "b": {
            "scene": f"{PIP} in his balloon on the rainbow bridge catching a SHOOTING STAR in a jar mid-flight. On the LEFT a giant BLUE carnival tent for balloons hanging in the sky, on the RIGHT a huge GREEN kite tree tangled with paper kites. Both large, fully visible, clearly separated",
            "text": "A shooting star zips past — Pip catches it in a jar! 'For luck!' Two ways forward: past the blue balloon carnival, or through the green kite tree?",
            "choices": [{"label": "Past the carnival", "next": "ba", "spot": "blue carnival tent"},
                        {"label": "Through the kite tree", "next": "bb", "spot": "green kite tree"}],
        },
        "aa": {
            "scene": f"{PIP} in his balloon over the windmill hill, wind-charm swinging bright. On the LEFT a jagged WHITE mountain pass squeezed between two snowy peaks, on the RIGHT a floating GOLD lantern city hanging from a huge cloud on chains. Both large, fully visible, clearly separated",
            "text": "The windmill hill catapults Pip UP! Two shortcuts split the sky: the narrow mountain pass, or the floating golden lantern city.",
            "choices": [{"label": "Fly through the mountain pass", "next": "m1", "spot": "white mountain pass"},
                        {"label": "Fly to the lantern city", "next": "m2", "spot": "gold lantern city"}],
        },
        "ab": {
            "scene": f"{PIP} in his balloon through the red rainbow arch, wind-charm glowing warm. On the LEFT a snowy WHITE mountain gap flashing between two peaks, on the RIGHT a warm ORANGE floating city of paper lanterns swaying on chains. Both large, fully visible, clearly separated",
            "text": "Ribbons whip past the balloon! The wind-charm hums. Two shortcuts appear: the snowy mountain gap, or the warm floating lantern city.",
            "choices": [{"label": "Fly to the mountain gap", "next": "m1", "spot": "white mountain gap"},
                        {"label": "Fly to the lantern city", "next": "m2", "spot": "orange lantern city"}],
        },
        "ba": {
            "scene": f"{PIP} in his balloon drifting past the blue carnival, star-jar tucked in the basket glowing. On the LEFT a big STAR-shaped SILVER balloon station spinning slowly, on the RIGHT a PINK bakery-bluff cliff with a giant iced cupcake on top. Both large, fully visible, clearly separated",
            "text": "Carnival horns cheer! Star-jar glows. Two shortcuts: the spinning silver starfish station, or the pink bakery cliff with a giant cupcake on top.",
            "choices": [{"label": "To the star station", "next": "m3", "spot": "silver star station"},
                        {"label": "Fly to the bakery cliff", "next": "m4", "spot": "pink bakery bluff"}],
        },
        "bb": {
            "scene": f"{PIP} in his balloon threading between paper kites in the kite tree, star-jar glowing bright. On the LEFT a huge SILVER star-shaped balloon platform spinning, on the RIGHT a warm PINK cliff dusted with flour beneath a big cupcake beacon. Both large, fully visible, clearly separated",
            "text": "Kites tickle the balloon! Star-jar shines lucky! Two shortcuts open: the silver starfish platform ahead, or the pink flour-dusted bakery cliff to the right.",
            "choices": [{"label": "Hop on the platform", "next": "m3", "spot": "silver star platform"},
                        {"label": "Fly to the pink cliff", "next": "m4", "spot": "pink flour cliff"}],
        },
        "m1": {
            "scene": f"{PIP} in his balloon inside the narrow mountain pass, wind-charm ringing bright. On the LEFT a huge friendly GOLDEN eagle offering a talon-boost, on the RIGHT a SNOWY LEDGE with a whole village of waving snowmen mid-cheer. Both large, fully visible, clearly separated",
            "text": "The mountain howls — the wind-charm sings back! The golden eagle offers a boost. Ride the eagle to the finish, or wave hi to the snowmen first?",
            "choices": [{"label": "Grab the eagle boost", "next": "end_eagle_boost", "spot": "golden eagle"},
                        {"label": "Wave to the snowmen", "next": "end_snow_stall", "spot": "snowy ledge"}],
        },
        "m2": {
            "scene": f"{PIP} in his balloon among lanterns of the floating city, wind-charm steadying the ride. On the LEFT a huge GOLD LANTERN gate hung with rainbow ribbons twinkling in the wind, on the RIGHT a warm crowd of paper lantern-balloons launching a COLORFUL FIREWORK spray upward. Both large, fully visible, clearly separated",
            "text": "The lantern-city cheers! The wind-charm holds the balloon steady. Sail through the gold finish-gate, or ride the firework spray in with a bang?",
            "choices": [{"label": "Fly through the gold gate", "next": "end_lantern_arrival", "spot": "gold lantern gate"},
                        {"label": "Ride the fireworks", "next": "end_lantern_fireworks", "spot": "colorful firework spray"}],
        },
        "m3": {
            "scene": f"{PIP} in his balloon docking on the silvery starfish balloon station, star-jar glowing bright. On the LEFT a spinning SILVER swirl-launcher that fires balloons like slingshots, on the RIGHT a shimmering RAINBOW confetti geyser bursting straight up. Both large, fully visible, clearly separated",
            "text": "The starfish station spins! Pip's star-jar glows bright — real luck! Aim the silver swirl-launcher toward the bakery, or ride the rainbow confetti geyser up?",
            "choices": [{"label": "Ride the swirl launcher", "next": "end_star_swirl", "spot": "silver swirl launcher"},
                        {"label": "Ride the confetti geyser up", "next": "end_star_shower", "spot": "rainbow confetti geyser"}],
        },
        "m4": {
            "scene": f"{PIP} in his balloon nearing the pink bakery bluff, star-jar sparkling like a compass. On the LEFT a GIANT WHITE frosted cupcake the size of a house on a pedestal (the Cup!), on the RIGHT a huge YELLOW oven chimney billowing warm cake-scented steam. Both large, fully visible, clearly separated",
            "text": "The bakery bluff! The Cup is a GIANT CUPCAKE — Auntie Toast's masterpiece! Land smoothly on the cupcake pedestal, or ride the yellow chimney straight up to victory?",
            "choices": [{"label": "Land on the cupcake", "next": "end_bakery_win", "spot": "giant white cupcake"},
                        {"label": "Ride the yellow chimney", "next": "end_bakery_bake", "spot": "yellow oven chimney"}],
        },
        "end_eagle_boost": {
            "scene": f"{PIP} in his balloon being pulled joyfully by a huge GOLDEN EAGLE over the finish ribbon at the pink bakery bluff, a giant frosted cupcake trophy waiting, sunrise sky, wind-charm still ringing",
            "text": "The eagle tows the balloon like a kite! Pip zooms over the ribbon in FIRST. Auntie Toast hands over the Cupcake Cup — 'For my winner!' The End!",
        },
        "end_snow_stall": {
            "scene": f"{PIP} in his balloon parked on the SNOWY mountain ledge surrounded by a whole choir of cheering snowmen, sipping cocoa from a snowman's mug, the pink bakery cliff far away in the sunrise",
            "text": "SNOWMAN CHOIR AMBUSH! They CHEER and pour cocoa. Pip can't leave — they're too polite. Race missed. Toastiest snowman party ever. Oopsie ending!",
            "bad": True,
        },
        "end_lantern_arrival": {
            "scene": f"{PIP} in his balloon gliding through a big glowing GOLD LANTERN gate hung with rainbow ribbons above the pink bakery, cupcake trophy waiting, floating lantern city cheering behind, sunrise",
            "text": "Straight through the lantern-city finish gate! Every lantern chimes at once. The Cupcake Cup gleams in the morning. Pip WINS! The End!",
        },
        "end_lantern_fireworks": {
            "scene": f"{PIP} in his balloon riding a shower of colorful FIREWORKS across the finish line at the bakery bluff, cupcake trophy sparkling below, sunrise sky exploding with color",
            "text": "BOOM — the firework spray carries Pip up and over the finish! Sparks turn to sprinkles on the Cupcake Cup. Loudest, brightest win ever! The End!",
        },
        "end_star_swirl": {
            "scene": f"{PIP} in his balloon fired by the plain SILVER SWIRL launcher tube with rivets and no markings spiralling gracefully toward the pink bakery finish, star-jar glowing bright, cupcake trophy waiting, sunrise",
            "text": "SPROING! A swirl of cloud-smoke, and Pip spirals right to the finish. Star-jar wish granted! The Cupcake Cup is his. The End!",
        },
        "end_star_shower": {
            "scene": f"{PIP} in his balloon covered head to paw in RAINBOW CONFETTI atop the star-station, star-jar sparkling but the pink bakery cliff visible far away, laughing crowd of racing balloons zooming past",
            "text": "WHOOSH — up the geyser! Pip is CONFETTI-COVERED and completely turned around. Star-jar giggles. The pink cupcake cliff drifts past far away. Second-to-last, but the sparkliest. Oopsie ending!",
            "bad": True,
        },
        "end_bakery_win": {
            "scene": f"{PIP} in his balloon touching down softly on a GIANT white frosted CUPCAKE pedestal at the pink bakery bluff, Auntie Toast the baker cheering with a sprinkle-medal, sunrise",
            "text": "Landing gear down — plop! Right on the giant cupcake. Auntie Toast pins a sprinkle-medal on Pip: 'Take the whole Cupcake Cup home!' The End!",
        },
        "end_bakery_bake": {
            "scene": f"{PIP} belly-flopped on the giant iced cupcake with frosting squished flat, icing all over his floppy ears and tail, a YELLOW OVEN CHIMNEY puffing behind him, Auntie Toast sighing, sunrise sky",
            "text": "UP the chimney! Pip is launched SO high he loops twice and belly-flops onto the cupcake, smooshing the frosting flat. 'You ARE the frosting now,' sighs Auntie Toast. Icing whiskers, icing tail, zero trophy. Oopsie ending!",
            "bad": True,
        },
    },
}


YOKAI_STYLE = (
    "Japanese festival-night children's picture-book illustration: warm "
    "paper-lantern glow, indigo twilight sky, torii gates, wooden bridges "
    "and stone lanterns, fireflies, soft woodblock-print texture, friendly "
    "round-eyed yokai creatures. Landscape orientation. Lanterns are plain "
    "paper with no writing. No text, no letters, no calligraphy, no "
    "watermark, no people."
)

# Traditional yokai, kid-friendly renditions: kappa (polite river spirit,
# water dish on head, loves cucumber), tanuki (round shapeshifter, belly
# drum), karakasa-obake (one-legged hopping umbrella ghost), chochin-obake
# (paper-lantern ghost with one eye and a friendly tongue), kitsune (fox
# spirit with blue foxfire), karasu-tengu (crow-faced mountain guardian
# with a big feather fan). All rendered as creatures, never humans.
YOKAI_PARADE = {
    "id": "yokai",
    "title": "The Yokai Lantern Parade",
    "character": MILO,
    "style": YOKAI_STYLE,
    "nodes": {
        "start": {
            "scene": f"{MILO} outside grandma's wooden house at twilight, an empty lantern hook by the door and small blue foxfire flames dancing away in two directions. On the LEFT mossy GREEN stone steps climbing to a shrine hill under small torii gates, on the RIGHT a RED arched wooden bridge over a slow dark river. Both large, fully visible, clearly separated",
            "text": "Tonight the yokai march in the great lantern parade — and grandma's lantern leads it! But a fox spirit just swished away with it. Moonrise is coming, Milo. Steps or bridge?",
            "scare": {"spot": "azalea bush beside the wooden house", "pop": "a swirl of glowing fireflies bursting upward in a spiral",
                      "reveal": "Fireflies! They want to march too. Follow the foxfire, Milo...", "sting": "boing", "delay": 1600},
            "choices": [{"label": "Climb the shrine steps", "next": "a", "spot": "green stone steps"},
                        {"label": "Cross the red bridge", "next": "b", "spot": "red wooden bridge"}],
        },
        "a": {
            "scene": f"{MILO} at a lantern-lit teahouse on the shrine steps where a round brown TANUKI with a leaf on his head drums his big belly, Milo offering him a rice cracker. On the LEFT a PURPLE festival drum cart with a big taiko drum heading uphill, on the RIGHT a GOLD shrine gate opening into dark cedar woods. Both large, fully visible, clearly separated",
            "text": "Boom-boom! A tanuki drums his tummy at the teahouse. Milo shares his last rice cracker. 'Mmm! Tanuki never forgets a snack,' he winks. Drum cart, or cedar woods?",
            "choices": [{"label": "Ride the drum cart", "next": "aa", "spot": "purple drum cart"},
                        {"label": "Take the shrine gate", "next": "ab", "spot": "gold shrine gate"}],
        },
        "b": {
            "scene": f"{MILO} on the riverbank below the red bridge where a friendly GREEN KAPPA with a water dish on its head bows politely from the shallows, Milo holding out a crunchy cucumber. On the LEFT a BLUE flat river punt boat tied to a post, on the RIGHT a YELLOW path between moonlit rice paddies with a straw scarecrow. Both large, fully visible, clearly separated",
            "text": "A kappa pops up and bows. Milo bows back — careful, not too deep, or the water spills! He offers his cucumber. 'CRUNCH. You are now my favourite,' says the kappa. Boat, or rice path?",
            "choices": [{"label": "Pole the river boat", "next": "ba", "spot": "blue river boat"},
                        {"label": "Trot the rice path", "next": "bb", "spot": "yellow rice path"}],
        },
        "aa": {
            "scene": f"{MILO} hopping off the drum cart in a moonlit bamboo grove where a one-legged KARAKASA umbrella ghost bounces happily with its tongue out. On the LEFT a GREEN bamboo tunnel arching over the path, on the RIGHT a stairway of glowing STONE lanterns climbing toward a windy ledge. Both large, fully visible, clearly separated",
            "text": "Boing! Boing! A one-legged umbrella ghost bounces across the grove. 'Parade? Parade!' it cheers, pointing both ways at once, which is not helpful. Bamboo tunnel, or lantern stairs?",
            "choices": [{"label": "Duck through the bamboo", "next": "m1", "spot": "green bamboo tunnel"},
                        {"label": "Climb the lantern stairs", "next": "m2", "spot": "stone lantern stairs"}],
        },
        "ab": {
            "scene": f"{MILO} deep in the cedar woods beneath a huge tree where a KARASU-TENGU crow guardian with a long beak sits holding a great feather fan. On the LEFT a BROWN rope bridge swaying between two cedars, on the RIGHT a round HOLLOW cedar door glowing warmly at the base of the biggest tree. Both large, fully visible, clearly separated",
            "text": "'WHO enters my woods?' booms the crow tengu — then he sees Milo's empty paws and softens. 'Ah. The fox took your lantern. Hmph.' He taps his fan. Rope bridge, or the cedar door?",
            "scare": {"spot": "the round hollow cedar door", "pop": "a tiny flying squirrel in a red festival coat leaping out with arms spread",
                      "reveal": "A flying squirrel in his festival coat! 'Is it parade time? Is it NOW?'", "sting": "boing", "delay": 1700},
            "choices": [{"label": "Cross the rope bridge", "next": "m1", "spot": "brown rope bridge"},
                        {"label": "Open the cedar door", "next": "m2", "spot": "hollow cedar door"}],
        },
        "ba": {
            "scene": f"{MILO} standing in the blue punt boat as the GREEN KAPPA paddles it smoothly down the dark river, fireflies rising off the water. On the LEFT a WHITE lotus-flower jetty shining on the water, on the RIGHT a bank of tall GLOWING firefly reeds parting like a curtain. Both large, fully visible, clearly separated",
            "text": "The kappa paddles — cucumber power! 'Fox went riverways,' he burbles. Fireflies lift off the water like sparks. Land at the lotus jetty, or push through the glowing reeds?",
            "choices": [{"label": "Land at the jetty", "next": "m3", "spot": "white lotus jetty"},
                        {"label": "Part the glowing reeds", "next": "m4", "spot": "glowing firefly reeds"}],
        },
        "bb": {
            "scene": f"{MILO} on the yellow paddy path where the STRAW SCARECROW tips its hat politely, small blue foxfire flames glowing along the mud ahead. On the LEFT a gate woven of STRAW bundles where the scarecrow points, on the RIGHT a small RED torii standing alone at the field's edge. Both large, fully visible, clearly separated",
            "text": "The scarecrow tips its hat — everyone is polite tonight! Blue foxfire flickers along the mud and splits at the field's end. Straw gate, or the little red torii?",
            "choices": [{"label": "Pass the straw gate", "next": "m3", "spot": "straw bundle gate"},
                        {"label": "Duck the red torii", "next": "m4", "spot": "red field torii"}],
        },
        "m1": {
            "scene": f"{MILO} on a windy mountain ledge above the whole lantern-lit town, the KARASU-TENGU crow guardian landing beside him with his huge feather fan spread wide, blue foxfire glowing on a moonlit hilltop across the valley. On the LEFT the tengu's giant GREY feather fan held out flat like a sail, on the RIGHT a narrow MOONLIT footpath winding down toward the hilltop. Both large, fully visible, clearly separated",
            "text": "From the ledge Milo spots it — foxfire, on the far hilltop! The tengu spreads his great fan. 'One gust, small cat. Or trust your own paws.' Fan-glide, or the moonlit path?",
            "choices": [{"label": "Ride the fan wind", "next": "end_fan_glide", "spot": "grey feather fan"},
                        {"label": "Run the moon path", "next": "end_moon_path", "spot": "moonlit foot path"}],
        },
        "m2": {
            "scene": f"{MILO} on top of a wooden drum tower hung with plain paper lanterns, the round brown TANUKI proudly presenting three parade instruments, the foxfire hilltop close below. On the LEFT the giant RED taiko drum with its skin stretched like a trampoline, in the MIDDLE a round BRASS gong hanging from a carved wooden frame, on the RIGHT a long BAMBOO flute resting on a silk cushion. All large, fully visible, clearly separated",
            "text": "The tanuki beat him here! 'Rice-cracker friend! Every parade needs a BIG sound — and foxes always come to listen.' Drum, gong, or flute — which one calls the fox?",
            "choices": [{"label": "Boom the taiko drum", "next": "end_drum_boing", "spot": "red taiko drum"},
                        {"label": "Bong the brass gong", "next": "end_gong_call", "spot": "round brass gong"},
                        {"label": "Play the bamboo flute", "next": "end_flute_dance", "spot": "long bamboo flute"}],
        },
        "m3": {
            "scene": f"{MILO} stepping into a misty riverbank clearing where a ring of BLUE foxfire flames burns gently on the grass, the KITSUNE fox spirit sitting inside it with grandma's plain paper lantern, a tiny trembling CHOCHIN lantern ghost with one big eye hiding behind her tail. On the LEFT the ring of blue foxfire flames on the grass, on the RIGHT a WET slide of smooth green river stones curving past the clearing toward a lotus pond. Both large, fully visible, clearly separated",
            "text": "There! The fox — and grandma's lantern! But wait. Behind her tail hides a tiny lantern ghost, trembling. 'My friend fears the dark,' the fox whispers. 'She needed a brave lantern.' Step into the ring, or take the slippery kappa stones?",
            "choices": [{"label": "Step into the ring", "next": "end_foxfire_friend", "spot": "blue foxfire ring"},
                        {"label": "Slide the kappa stones", "next": "end_kappa_splash", "spot": "green stone slide"}],
        },
        "m4": {
            "scene": f"{MILO} arriving on the moonlit hilltop under one great torii, the KITSUNE fox spirit curled asleep around grandma's plain paper lantern, a shy little CHOCHIN lantern ghost with one big eye peeking from behind it, the town's lantern parade gathering far below. On the LEFT the sleepy curled FOX spirit with her white-tipped tail over her nose, on the RIGHT the SHY little round lantern ghost peeking with one eye. Both large, fully visible, clearly separated",
            "text": "The hilltop! The fox curls around grandma's lantern — and a little lantern ghost peeks out, one big eye blinking. 'She was scared of the dark,' yawns the fox, 'so I borrowed the bravest lantern.' Wake the fox, or say hello to the little ghost?",
            "choices": [{"label": "Wake the fox gently", "next": "end_fox_sorry", "spot": "sleepy fox spirit"},
                        {"label": "Greet the lantern ghost", "next": "end_lantern_buddy", "spot": "shy lantern ghost"}],
        },
        "end_fan_glide": {
            "scene": f"{MILO} tumbling through the night sky after a too-strong fan gust, landing splat on grandma's rooftop far from the hilltop, the lantern parade starting tiny in the distance below",
            "text": "WHOOSH — the fan-gust is a HURRICANE. Milo flips three times and lands splat on grandma's roof, two mountains away. He can hear the parade start without him. Grandma finds him dangling from the gutter. 'Too much fan,' he admits. Oopsie ending!",
            "bad": True,
        },
        "end_moon_path": {
            "scene": f"{MILO} trotting the last steps of a winding moonlit path onto the hilltop, followed by the bouncing KARAKASA umbrella ghost and a line of glowing fireflies, the KITSUNE waiting and holding out grandma's plain paper lantern with her tail",
            "text": "Pat-pat-pat go Milo's paws — and boing-boing behind him comes the umbrella ghost, and the fireflies, and half the mountain! The fox laughs and hands back the lantern: 'You brought your own parade.' The End!",
        },
        "end_drum_boing": {
            "scene": f"{MILO} flying comically through the night sky high above the lantern-lit town after a mighty drum bounce, paws spread wide, grandma's wooden porch with its soft cushion visible far below, the drum tower and foxfire hilltop tiny in the distance",
            "text": "BOOM! The tanuki drums a little TOO well. Milo soars over the whole town — wheee, oops — and lands whump on grandma's porch cushion. Right where he started, dizzy but famous. Oopsie ending!",
            "bad": True,
        },
        "end_gong_call": {
            "scene": f"{MILO} mid gong-strike on the drum tower, deep golden rings of sound rippling out across the lantern-lit night, the KITSUNE fox spirit trotting up the tower steps carrying grandma's plain paper lantern in her jaws, the little CHOCHIN lantern ghost floating shyly behind her",
            "text": "BOOOONG. The gong rolls over every rooftop like a warm gold wave. Far away, two fox ears twitch... and up the steps trots the fox herself, lantern in her jaws. 'You rang?' She trades it back for one more gong. Deal! The End!",
        },
        "end_flute_dance": {
            "scene": f"{MILO} playing the long bamboo flute on the tower top while the KARAKASA umbrella ghost and a winding stream of fireflies dance a line down toward the hilltop, the KITSUNE waltzing up with grandma's plain paper lantern balanced on her head, the little CHOCHIN ghost swaying happily",
            "text": "Milo plays a wobbly little tune — and everything that hears it starts to dance. The umbrella ghost boings in rhythm, the fireflies swirl, and the fox waltzes over and hands back the lantern mid-twirl. The parade starts early tonight. The End!",
        },
        "end_foxfire_friend": {
            "scene": f"{MILO} sitting calmly inside the ring of cool blue foxfire beside the KITSUNE, holding out his own tiny glowing yellow lantern to the little CHOCHIN lantern ghost who hugs it with stubby arms, grandma's plain paper lantern safe by Milo's paws",
            "text": "The foxfire is cool as moonlight. Milo holds out his own tiny lantern: 'She can borrow MINE. It's small, but it's brave.' The little ghost hugs it tight and glows twice as bright. The fox returns grandma's lantern with a bow. The End!",
        },
        "end_kappa_splash": {
            "scene": f"{MILO} soaked and dripping in a moonlit lotus pond at the bottom of the smooth stone slide, a lotus petal flopped on his head, the GREEN KAPPA covering its eyes kindly on the bank, blue foxfire twinkling away up the hill",
            "text": "The kappa slide is fast. VERY fast. SPLOOSH — lotus pond. 'That one is for kappas,' says the kappa, fishing him out politely. Up the hill, the foxfire giggles away. Grandma dries his whiskers by the fire. Oopsie ending!",
            "bad": True,
        },
        "end_fox_sorry": {
            "scene": f"{MILO} nose to nose with the KITSUNE on the moonlit hilltop as she wakes mid-yawn, her faint tail-tips glowing, gently nudging grandma's plain paper lantern back to him while the little CHOCHIN lantern ghost watches hopefully",
            "text": "The fox wakes mid-yawn. 'Oh. The owner.' She nudges the lantern back, ears low. 'Borrowing without asking is not very good manners, even for a fox.' Milo forgives her — IF she and her little friend march up front with him. Deal! The End!",
        },
        "end_lantern_buddy": {
            "scene": f"{MILO} and the little CHOCHIN lantern ghost walking side by side at the head of the great yokai lantern parade down the hill, the ghost proudly carrying Milo's tiny yellow lantern, Milo carrying grandma's plain paper lantern high, the KITSUNE, TANUKI, KAPPA and KARAKASA umbrella ghost marching behind",
            "text": "'Hello. I'm Milo. Want to march with me?' The little ghost's eye goes wide — then bright as a star. Down the hill they go, two lanterns leading: everyone marching, tanuki drumming, kappa dripping politely. Grandma waves from the porch. The End!",
        },
    },
}


CLOUD_CASTLE_STYLE = (
    "Dreamy pastel sky-kingdom children's picture-book illustration: "
    "cotton-candy clouds at dusk, pearly castle towers, moonbeams and "
    "soft auroras, twinkling stars, gentle pinks lavenders and golds. "
    "Landscape orientation. No text, no letters, no watermark, no people."
)

CLOUD_CASTLE = {
    "id": "cloud",
    "title": "Luna and the Cloud Castle Ball",
    "character": LUNA,
    "style": CLOUD_CASTLE_STYLE,
    "nodes": {
        "start": {
            "scene": f"{LUNA} on a twilight cloud meadow gazing up at a pearly CLOUD CASTLE whose highest tower is going dark, her invitation ribbon around her neck. On the LEFT a staircase of GOLD sunset clouds curling up to the gate, on the RIGHT a SILVER gondola basket hanging from a moonbeam cable. Both large, fully visible, clearly separated",
            "text": "Tonight is Luna's very first Moon Ball! But look — the castle's great light is going out. No light, no ball, no dancing! Quick, Luna. Golden stairs, or the moonbeam gondola?",
            "choices": [{"label": "Climb the gold stairs", "next": "a", "spot": "gold cloud stairs"},
                        {"label": "Ride the moon gondola", "next": "b", "spot": "silver moon gondola"}],
        },
        "a": {
            "scene": f"{LUNA} on the golden cloud stairs sheltering a small soggy blue RAIN SPRITE under her sparkly mane, drizzle falling from one grumpy little cloud. On the LEFT a PINK cotton-candy cloud garden full of moonflowers, on the RIGHT a WHITE swan-shaped boat resting on a still cloud pond. Both large, fully visible, clearly separated",
            "text": "Halfway up, a little rain sprite sits dripping under its own grumpy cloud. Luna shares her warm mane. 'Nobody EVER shares,' it sniffles happily. Cotton garden, or swan boat?",
            "choices": [{"label": "Walk the cotton garden", "next": "aa", "spot": "pink cotton garden"},
                        {"label": "Sail the swan boat", "next": "ab", "spot": "white swan boat"}],
        },
        "b": {
            "scene": f"{LUNA} in the silver gondola beside a fluffy CLOUD SHEEP conductor with a tiny bell, sharing her moon-biscuit as the castle towers drift closer. On the LEFT a springy BLUE thundercloud bouncing like a trampoline, on the RIGHT a GREEN shimmering aurora bridge arcing to a side tower. Both large, fully visible, clearly separated",
            "text": "'Tickets! Biscuits also accepted,' baas the cloud sheep. Luna splits her moon-biscuit. 'Generous AND fluffy-adjacent!' Two ways to the castle: bouncy thundercloud, or aurora bridge?",
            "choices": [{"label": "Bounce the thundercloud", "next": "ba", "spot": "blue thundercloud trampoline"},
                        {"label": "Cross the aurora bridge", "next": "bb", "spot": "green aurora bridge"}],
        },
        "aa": {
            "scene": f"{LUNA} in the pink cotton-candy garden tucking one glowing white MOONFLOWER into her mane, castle gate ahead. On the LEFT tall CRYSTAL double doors beaded with rain, on the RIGHT a round PEARL hatch low in the castle wall with hoofprint-sized steps. Both large, fully visible, clearly separated",
            "text": "The moonflowers hum softly. Luna tucks one in her mane — for luck. The castle has a grand door and a small door. Grand crystal doors, or the little pearl hatch?",
            "choices": [{"label": "Push the crystal doors", "next": "m1", "spot": "crystal rain doors"},
                        {"label": "Slip through the hatch", "next": "m2", "spot": "round pearl hatch"}],
        },
        "ab": {
            "scene": f"{LUNA} gliding across the still cloud pond in the white swan boat, star reflections rippling, the castle wall rising ahead. On the LEFT a tall gate of golden HARP strings glowing gently, on the RIGHT a SPIRAL seashell staircase climbing the outside of a tower. Both large, fully visible, clearly separated",
            "text": "The swan boat glides through star reflections — shhh. The castle wall rises up ahead. In through the singing harp gate, or up the spiral shell stairs?",
            "choices": [{"label": "Part the harp strings", "next": "m1", "spot": "gold harp gate"},
                        {"label": "Climb the shell stairs", "next": "m2", "spot": "spiral shell stairs"}],
        },
        "ba": {
            "scene": f"{LUNA} mid-bounce on the springy blue thundercloud, mane flying, tiny giggling thunder rumbles under her hooves, two tower entrances ahead. On the LEFT a wide WHITE cloud slide swooping into a tower window, on the RIGHT a row of floating BRASS bell buoys stepping up to a balcony. Both large, fully visible, clearly separated",
            "text": "Boing! Boing! The thundercloud giggles thunder every bounce. Two ways in: the big cloud slide, or hop the ringing bell buoys?",
            "choices": [{"label": "Swoop the cloud slide", "next": "m3", "spot": "white cloud slide"},
                        {"label": "Hop the bell buoys", "next": "m4", "spot": "brass bell buoys"}],
        },
        "bb": {
            "scene": f"{LUNA} trotting across the green aurora bridge as ribbons of light swirl around her hooves, the dim great tower close now. On the LEFT an archway of woven RIBBON lights pulsing softly, on the RIGHT a tiny STAR ferry boat crewed by three baby stars waving. Both large, fully visible, clearly separated",
            "text": "The aurora swirls like ribbons in a dance — almost ball-ready! The great tower is close. Under the ribbon arch, or aboard the little star ferry?",
            "choices": [{"label": "Duck the ribbon arch", "next": "m3", "spot": "ribbon light arch"},
                        {"label": "Board the star ferry", "next": "m4", "spot": "little star ferry"}],
        },
        "m1": {
            "scene": f"{LUNA} in the grand chandelier hall of the cloud castle, the huge STAR CHANDELIER hanging dark and quiet, a faint trail of wobbly glitter dust drifting from it, cloud sheep and rain sprites waiting hopefully around the walls. On the LEFT the great dark STAR chandelier overhead, on the RIGHT a long VELVET curtain swaying with a suspicious sparkle behind it. Both large, fully visible, clearly separated",
            "text": "The great hall. The chandelier hangs dark — but glitter dust drifts down, wobbly as a shy giggle. Someone is HIDING up there. Call up to the chandelier, or peek behind the curtain?",
            "choices": [{"label": "Call to the chandelier", "next": "end_chandelier_comet", "spot": "dark star chandelier"},
                        {"label": "Peek behind the curtain", "next": "end_curtain_giggle", "spot": "long velvet curtain"}],
        },
        "m2": {
            "scene": f"{LUNA} in the castle kitchen where a plump CLOUD SHEEP cook stirs an enormous vat of wobbling moon pudding, wobbly glitter dust sprinkled across the floor toward the pantry. On the LEFT the enormous WOBBLING pudding vat on its stove, on the RIGHT a cold blue PANTRY door outlined in frost with glitter at the gap. Both large, fully visible, clearly separated",
            "text": "The kitchen! Moon pudding wobbles in a giant vat, and wobbly glitter leads... somewhere. 'Mind the vat, dear,' warns the cook. Follow the glitter to the frosty pantry, or peek in the pudding first?",
            "choices": [{"label": "Peek in the pudding", "next": "end_pudding_plunge", "spot": "wobbling pudding vat"},
                        {"label": "Open the frosty pantry", "next": "end_pantry_warmup", "spot": "frosty pantry door"}],
        },
        "m3": {
            "scene": f"{LUNA} in the star nursery tower where rows of tiny cloud cradles rock baby stars to sleep. On the LEFT one WOBBLING cloud cradle spilling too-big sparkles over its edge, in the MIDDLE a small SILVER cradle gently humming a tune all by itself, on the RIGHT a big BOUNCY cloud cot piled high with pillows. All large, fully visible, clearly separated",
            "text": "Shhh — the star nursery! Baby stars snore tiny golden snores. One cradle wobbles, one cradle hums, and one cot looks suspiciously bouncy. Somebody extra is hiding here. Which one, Luna?",
            "choices": [{"label": "Rock the wobbly cradle", "next": "end_nursery_lullaby", "spot": "wobbling cloud cradle"},
                        {"label": "Listen to the humming", "next": "end_humming_harmony", "spot": "silver humming cradle"},
                        {"label": "Check the bouncy cot", "next": "end_bounce_home", "spot": "bouncy cloud cot"}],
        },
        "m4": {
            "scene": f"{LUNA} stepping onto the grand ballroom balcony where the whole ball waits frozen in the dim — cloud sheep in bow ties, rain sprites holding trays — and one gauzy CURTAIN by the balcony glows faintly from behind. On the LEFT the gauzy GLOWING balcony curtain, on the RIGHT a grand RAINBOW slide curving from the balcony down to the empty dance floor. Both large, fully visible, clearly separated",
            "text": "The ballroom holds its breath in the half-dark. And there — behind the gauzy curtain — a faint, wobbly glow. Say hello softly, or make an entrance down the rainbow slide?",
            "choices": [{"label": "Whisper to the glow", "next": "end_balcony_reveal", "spot": "glowing balcony curtain"},
                        {"label": "Take the rainbow slide", "next": "end_slide_entrance", "spot": "grand rainbow slide"}],
        },
        "end_chandelier_comet": {
            "scene": f"{LUNA} below the great star chandelier as a small BABY COMET with a wobbly zigzag sparkle-tail peeks out from the dark crystals above, her moonflower glowing in her mane, cloud sheep gazing up",
            "text": "'I see you,' Luna says kindly. A baby comet peeks out. 'My sparkle went WOBBLY. Everyone will laugh.' Luna shakes her rainbow mane: 'Wobbly is my favourite colour.' The comet giggles — and the chandelier BLAZES. Ball time! The End!",
        },
        "end_curtain_giggle": {
            "scene": f"{LUNA} nose-first in the long velvet curtain with the little blue RAIN SPRITE from the stairs tangled in it laughing, while above them the BABY COMET peeks down from the dark chandelier, amused",
            "text": "Whoosh — the curtain giggles? It's her rain sprite friend, tangled up! 'I came to help — the curtain won.' Above them, a wobbly little comet laughs so hard it lights up — and the chandelier catches the giggle-light. Ball time! The End!",
        },
        "end_pudding_plunge": {
            "scene": f"{LUNA} up to her ears in the enormous vat of moon pudding, pudding blobs on her horn, the CLOUD SHEEP cook holding a ladle with gentle disappointment, wobbly glitter trail still leading to the pantry",
            "text": "The pudding wobbled. Luna wobbled. SPLOOP. 'Fished a unicorn out of my pudding,' sighs the cook, 'that's new.' Luna misses the comet — but arrives at the ball smelling deliciously of vanilla. Oopsie ending!",
            "bad": True,
        },
        "end_pantry_warmup": {
            "scene": f"{LUNA} in the frosty pantry doorway wrapping her warm rainbow mane around a shivering BABY COMET whose wobbly tail thaws from frost-blue to gold, the cloud sheep cook bringing a mug of warm moon pudding",
            "text": "In the frosty pantry shivers a baby comet. 'I hid till my sparkle froze wobbly,' it chatters. Luna wraps it in her mane; the cook brings warm pudding. The wobble melts into the prettiest zigzag — and it zooms up to light the ball! The End!",
        },
        "end_nursery_lullaby": {
            "scene": f"{LUNA} beside the wobbling cradle singing softly to the BABY COMET curled inside it, her moonflower glowing like a nightlight, baby stars peeking from their cradles as the nursery fills with gentle gold light",
            "text": "In the wobbly cradle hides the baby comet, sniffling sparkles. Luna hums grandma's lullaby, low and soft. 'Your wobble sounds like dancing,' she whispers. The comet peeks... smiles... and rises glowing to light the whole castle. The End!",
        },
        "end_humming_harmony": {
            "scene": f"{LUNA} resting her chin on the small silver cradle humming a duet with the BABY COMET curled inside it, their two wobbly tunes weaving into ribbons of gold light that spiral up the nursery tower, baby stars waking to listen",
            "text": "The humming cradle is humming a DUET — the baby comet inside hums the wobbly half. Luna joins in. Wobble plus wobble makes a waltz! The tune floats down the tower, the chandelier catches it, and the whole castle lights up dancing. The End!",
        },
        "end_bounce_home": {
            "scene": f"{LUNA} flying out of a tower window on a runaway BOUNCY cloud cot, pillows scattering across the night sky, the cloud castle glowing behind her and her own cloud meadow rushing up below",
            "text": "The cot is bouncier than a thundercloud. BOING — out the window sails Luna, pillows and all, right back to her meadow. She hears the ball music start without her... but a comet-lit sky is quite a show from a pillow pile. Oopsie ending!",
            "bad": True,
        },
        "end_balcony_reveal": {
            "scene": f"{LUNA} nose to nose with the shy BABY COMET behind the gauzy balcony curtain, its wobbly tail drawing zigzag light patterns that the frozen ballroom crowd watches in wonder below",
            "text": "'Hello, wobbly one.' The comet hides its tail. 'It zigzags. Comets should swoosh.' Luna points her horn at her own curly mane: 'Straight is boring.' The comet dares one zigzag — the crowd gasps with delight — and the ball lights up dancing. The End!",
        },
        "end_slide_entrance": {
            "scene": f"{LUNA} crashed horn-first into a big cloud-punch bowl at the bottom of the rainbow slide, pink punch splashed everywhere, drenched cloud sheep staring, the BABY COMET peeking down from the dark chandelier above",
            "text": "Luna takes the slide — WHEEE — TOO FAST — and crashes horn-first into the cloud-punch bowl. SPLASH! Punch everywhere, cloud sheep drenched, the comet peeks down and decides to stay hidden. Luna is the pinkest, wettest unicorn at a ball that never starts. Oopsie ending!",
            "bad": True,
        },
    },
}


COOKIE_CAPER_STYLE = (
    "Cozy moonlit village-bakery children's picture-book illustration: "
    "warm window glow, flour dust in moonbeams, cobbled lanes, chubby "
    "clouds and a big friendly moon, soft buttery yellows and deep night "
    "blues. Landscape orientation. No text, no letters, no watermark, "
    "no people."
)

COOKIE_CAPER = {
    "id": "cookie",
    "title": "Pip and the Midnight Cookie Caper",
    "character": PIP,
    "style": COOKIE_CAPER_STYLE,
    "nodes": {
        "start": {
            "scene": f"{PIP} in the moonlit bakery kitchen staring at an empty cooling rack with one star-shaped cookie-cutter left behind, a crumb trail splitting two ways. On the LEFT an open BLUE window with crumbs on the sill, on the RIGHT a creaky brown CELLAR door ajar with floury little footprints. Both large, fully visible, clearly separated",
            "text": "Gasp! Auntie Toast's star cookies for the fair — GONE! Only crumbs remain, and crumbs mean clues. Detective Pip is ON the case. Out the window, or down the cellar?",
            "scare": {"spot": "the tall flour tin beside the cooling rack", "pop": "a tiny white kitten covered in flour sneezing a flour cloud",
                      "reveal": "A flour kitten! Achoo! 'Not me,' she squeaks, 'I only steal NAPS.'", "sting": "boing", "delay": 1600},
            "choices": [{"label": "Hop out the window", "next": "a", "spot": "blue open window"},
                        {"label": "Creep down the cellar", "next": "b", "spot": "brown cellar door"}],
        },
        "a": {
            "scene": f"{PIP} in the moonlit village square by the old stone fountain, sharing his own biscuit with a round NIGHT OWL perched on the fountain edge. On the LEFT a STRIPED red-and-white market tent glowing faintly, on the RIGHT a mossy grey STONE well with a rope and bucket. Both large, fully visible, clearly separated",
            "text": "By the fountain sits a hungry night owl. Pip snaps his own biscuit in two. 'Hoo. Kind pup. I see everything from up high,' she winks. The crumbs split. Market tent, or the old well?",
            "choices": [{"label": "Peek in the tent", "next": "aa", "spot": "striped market tent"},
                        {"label": "Check the old well", "next": "ab", "spot": "grey stone well"}],
        },
        "b": {
            "scene": f"{PIP} in the flour cellar where tiny WEBBED footprints stamp through spilled flour, a small MOUSE in a chef hat pointing at them like an expert. On the LEFT a teetering white MOUNTAIN of flour sacks, on the RIGHT a wooden DOUGH cart with round wheels and a warm blanket of dough. Both large, fully visible, clearly separated",
            "text": "Footprints in the flour — tiny, and WEBBED?! 'Not mouse feet,' testifies a mouse in a chef hat, 'mouse feet are elegant.' The prints go two ways. Flour mountain, or dough cart?",
            "choices": [{"label": "Climb the flour sacks", "next": "ba", "spot": "white flour sacks"},
                        {"label": "Ride the dough cart", "next": "bb", "spot": "wooden dough cart"}],
        },
        "aa": {
            "scene": f"{PIP} inside the striped market tent among crates and baskets, holding up one tiny YELLOW feather stuck to a cookie crumb, moonlight through the tent stripes. On the LEFT an ORANGE pumpkin stall stacked with round pumpkins, on the RIGHT a GREEN orchard gate standing open toward apple trees. Both large, fully visible, clearly separated",
            "text": "In the tent: crumbs, crumbs, and — a tiny yellow feather! 'The thief is small, fluffy, and possibly adorable,' Pip deduces. Pumpkin stall, or orchard gate?",
            "choices": [{"label": "Search the pumpkins", "next": "m1", "spot": "orange pumpkin stall"},
                        {"label": "Take the orchard gate", "next": "m2", "spot": "green orchard gate"}],
        },
        "ab": {
            "scene": f"{PIP} leaning over the mossy stone well, his floppy ears hanging down, a faint tiny quacking echo rising from below with sparkles of moonlight on the water, a LAVENDER garden path curving away beside the well. On the LEFT the deep mossy WELL mouth with its bucket rope, on the RIGHT the purple LAVENDER path lined with sleepy bees. Both large, fully visible, clearly separated",
            "text": "Pip leans into the well. 'Helloooo?' 'Quack-quack-quack!' the well answers. Quacks?! The echo bounces somewhere behind the lavender. Ride the bucket down, or follow the lavender path?",
            "choices": [{"label": "Ride the bucket down", "next": "m1", "spot": "mossy well bucket"},
                        {"label": "Follow the lavender", "next": "m2", "spot": "purple lavender path"}],
        },
        "ba": {
            "scene": f"{PIP} balanced atop the flour-sack mountain in the cellar, one sack leaking a thin flour waterfall, webbed prints climbing to a small round window high in the wall. On the LEFT the small round MOON window above the sacks, on the RIGHT a wide brick OVEN door glowing warm and orange below. Both large, fully visible, clearly separated",
            "text": "Up the flour mountain — carefully, CAREFULLY — the webbed prints march to a little moon window. But the warm oven door glows too, and thieves love warm. Window, or oven nook?",
            "choices": [{"label": "Squeeze out the window", "next": "m3", "spot": "round moon window"},
                        {"label": "Sniff the oven nook", "next": "m4", "spot": "orange oven door"}],
        },
        "bb": {
            "scene": f"{PIP} rolling through the moonlit bakery garden on the wooden dough cart, flour dust trailing like a comet tail, the cart track forking ahead. On the LEFT a tall wooden WINDMILL turning slowly on the hill lane, on the RIGHT thick green RIVERBANK reeds glowing with fireflies. Both large, fully visible, clearly separated",
            "text": "The dough cart rolls — wheee, a squishy getaway! Ahead the track forks: up the windmill lane, or down to the riverbank reeds. Where do webbed feet go? Pip narrows his eyes. Everywhere wet.",
            "choices": [{"label": "Climb the windmill lane", "next": "m3", "spot": "tall wooden windmill"},
                        {"label": "Search the reeds", "next": "m4", "spot": "green riverbank reeds"}],
        },
        "m1": {
            "scene": f"{PIP} at the moonlit bakery porch where the crumb trail ends beneath the wooden steps, one star cookie sticking out of a knothole, the NIGHT OWL gliding overhead pointing with her wing. On the LEFT the dark gap UNDER the porch steps with straw poking out, on the RIGHT the round KNOTHOLE in the step plank with the star cookie wedged in it. Both large, fully visible, clearly separated",
            "text": "The trail ends at the bakery's own porch! A star cookie pokes from a knothole, and something rustles under the steps. The owl circles: 'Hoo! Gently now.' Peek under the porch, or pull the cookie?",
            "choices": [{"label": "Peek under the porch", "next": "end_porch_nest", "spot": "dark porch gap"},
                        {"label": "Pull the star cookie", "next": "end_cookie_tug", "spot": "round step knothole"}],
        },
        "m2": {
            "scene": f"{PIP} in the moonlit apple orchard where the crumb trail winds between fallen apples, a row of tiny webbed prints beside it, one glowing LANTERN-shaped beehive humming in a tree. On the LEFT a leaning APPLE basket tipped on its side with crumbs around it, on the RIGHT the fat LAVENDER bushes at the orchard edge trembling suspiciously. Both large, fully visible, clearly separated",
            "text": "Orchard crumbs — the thief snacked here too. Tidy little bites. The apple basket rocks... and the lavender trembles... 'Both suspicious,' whispers Detective Pip. Basket, or bushes?",
            "choices": [{"label": "Lift the apple basket", "next": "end_basket_family", "spot": "leaning apple basket"},
                        {"label": "Part the lavender", "next": "end_lavender_sneeze", "spot": "fat lavender bushes"}],
        },
        "m3": {
            "scene": f"{PIP} on the windmill hill lane under the slow-turning sails, webbed prints crossing a puddle toward the mill door, a HONEY jar shelf built into the mill wall glistening in moonlight. On the LEFT the wooden MILL door with prints on the step, on the RIGHT the sticky golden HONEY jar shelf gleaming within paw's reach. Both large, fully visible, clearly separated",
            "text": "The prints march right past the mill's honey shelf. Right PAST it. 'Impressive willpower,' Pip admits. His own tummy grumbles. Follow the prints inside, or one tiny lick of honey first?",
            "choices": [{"label": "Follow the prints in", "next": "end_mill_sleepover", "spot": "wooden mill door"},
                        {"label": "One tiny honey lick", "next": "end_honey_stuck", "spot": "golden honey shelf"}],
        },
        "m4": {
            "scene": f"{PIP} at the firefly-lit riverbank, the moon huge on the water. On the LEFT a tiny raft made of a BREAD slice drifting near the reeds with star cookie crumbs aboard, in the MIDDLE an upside-down RED umbrella bobbing on the water like a little boat with a tiny paddle, on the RIGHT a dark cozy hollow under the old WILLOW roots at the bank. All large, fully visible, clearly separated",
            "text": "Riverbank clues EVERYWHERE. A bread raft. An umbrella boat. A rustle in the willow roots. Only a very hungry sailor builds a bread boat... Detective Pip must pick his lead.",
            "choices": [{"label": "Wade to the raft", "next": "end_raft_rescue", "spot": "drifting bread raft"},
                        {"label": "Board the umbrella boat", "next": "end_umbrella_ferry", "spot": "red umbrella boat"},
                        {"label": "Peek under the willow", "next": "end_willow_den", "spot": "old willow roots"}],
        },
        "end_porch_nest": {
            "scene": f"{PIP} lying flat peering under the bakery porch where FIVE fluffy yellow DUCKLINGS huddle in a straw nest around a pile of star cookies arranged like a glowing nightlight, the smallest duckling mid-bite",
            "text": "Under the porch: five ducklings, one cookie pile stacked like a glowing star. 'Our nightlight went out,' peeps the smallest, 'and these look like it. Also they are delicious.' Pip melts. Fresh cookies get baked, ducklings get adopted by the bakery. Case closed! The End!",
        },
        "end_cookie_tug": {
            "scene": f"{PIP} tumbling backward into a rain barrel after a cookie snaps in half, soaking wet, five yellow DUCKLINGS popping out from under the porch steps quacking at him, moonlight on the puddle",
            "text": "Pip pulls the cookie — CRACK — it snaps in half and he tumbles backward into the rain barrel. Five ducklings pop out and quack at the soggy detective. 'He ate the evidence!' peeps the smallest. Pip did not, but nobody believes a dripping puppy. Oopsie ending!",
            "bad": True,
        },
        "end_basket_family": {
            "scene": f"{PIP} lifting the apple basket to reveal a MAMA DUCK and five yellow ducklings nested inside with three star cookies, the ducklings wearing cookie crumbs like freckles, the night owl landing beside Pip",
            "text": "Under the basket: one mama duck, five ducklings, three cookies, zero regrets. 'We got lost, and the stars were the only thing that felt like home,' says mama. Pip walks them home to the pond — right past the bakery, where a warm new batch is already rising. The End!",
        },
        "end_lavender_sneeze": {
            "scene": f"{PIP} mid-enormous-sneeze in a purple cloud of lavender pollen, petals stuck all over his fur, tiny webbed footprints escaping across the moonlit grass beyond him",
            "text": "The lavender was extremely lavender. AH — AH — CHOOO! Petals everywhere, clues nowhere, and tiny webbed feet pitter-patter away giggling. Pip trots home smelling like a fancy soap. The ducklings return the cookies themselves at sunrise. Oopsie ending!",
            "bad": True,
        },
        "end_mill_sleepover": {
            "scene": f"{PIP} inside the cozy windmill where five yellow DUCKLINGS sleep in a flour-dusted huddle around the last star cookies, mama duck tucking them in with a wing, moonlight turning with the mill sails",
            "text": "Inside the mill: five ducklings fast asleep around the last cookies, guarded by one tired mama. 'They followed the star shapes home,' she whispers. Pip stands watch till morning, then leads the parade back for breakfast and fresh baking. Detective AND hero. The End!",
        },
        "end_honey_stuck": {
            "scene": f"{PIP} with one paw comically stuck in the golden honey jar, honey strings stretching everywhere, five yellow DUCKLINGS emerging from the mill door to watch with wide eyes, the moon beaming",
            "text": "One tiny lick. One ENORMOUS stick. Pip and the honey jar become best friends forever, whether he likes it or not. The ducklings waddle out to watch the show. Auntie Toast frees him at dawn — with warm water and zero questions. Oopsie ending!",
            "bad": True,
        },
        "end_raft_rescue": {
            "scene": f"{PIP} chest-deep in the moonlit river gently pushing the bread raft ashore with his nose, one shivering yellow DUCKLING aboard hugging a star cookie, the other ducklings cheering from the reeds",
            "text": "One brave duckling drifted too far on the bread boat. Pip wades in — brrr — and nose-pushes the raft home. 'My captain!' peeps the duckling, knighting him with a soggy cookie. The whole flock follows him back to the bakery for a dawn feast. The End!",
        },
        "end_umbrella_ferry": {
            "scene": f"{PIP} sitting proudly in the upside-down red umbrella while five yellow DUCKLINGS paddle it across the moonlit river like a ferry crew, a trail of star cookie crumbs marking the route to the willow bank, fireflies lighting the way",
            "text": "The umbrella is a FERRY — crewed by five paddling ducklings! 'Fare is one biscuit,' peeps the captain. Pip pays. They paddle him straight to their cookie hideout, confessing everything adorably along the way. Fresh batch at dawn for the whole crew. The End!",
        },
        "end_willow_den": {
            "scene": f"{PIP} peering into the willow-root hollow where the DUCKLING family has built a cookie pantry — star cookies stacked in neat rows — mama duck offering Pip one with her wing, fireflies lighting the den",
            "text": "Inside the willow roots: the tidiest little cookie pantry in the kingdom. 'We were saving them for winter,' says mama duck, offering Pip the first one back. 'Winter is in EIGHT months,' says Pip. They compromise: everyone marches to the bakery to bake more. The End!",
        },
    },
}
