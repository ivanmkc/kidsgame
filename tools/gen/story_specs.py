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
            "text": "The cellar glows with a hundred little jam jars. A HUGE monster shadow rises on the wall! But look closer... it's a teeny-tiny mouse in a chef's hat, holding jam toast.",
            "scare": {"spot": "the shelf casting the giant monster shadow", "pop": "a tiny proud mouse in a chef hat holding a candle, taking a bow",
                      "reveal": "The giant monster is... a tiny chef mouse and his candle! He offers Milo blackberry jam.", "sting": "thunder", "delay": 1900},
            "choices": [{"label": "Share the jam 🫙", "next": "end_feast"},
                        {"label": "Ask about the key 🗝️", "next": "end_key"}],
        },
        "bb": {
            "scene": f"{MILO} inside a moonlit greenhouse of silver plants, vines swaying with no wind, a tall shape draped in a white sheet standing among the pots",
            "text": "The greenhouse plants sway... but there is no wind. And that tall white shape was NOT there before. It giggles a friendly little giggle. Could it be... a Garden Phantom?",
            "scare": {"spot": "the tall shape draped in a white sheet", "pop": "a tall friendly heron wearing the sheet like a cape, striking a heroic pose",
                      "reveal": "A heron in a bedsheet! 'I am the Garden Phantom!' she announces proudly. Nobody is scared.", "sting": "thunder", "delay": 1700},
            "choices": [{"label": "Cheer for the Phantom 🦸", "next": "end_phantom"},
                        {"label": "Ask about the key 🗝️", "next": "end_key"}],
        },
        "end_family": {
            "scene": f"{MILO} and a ghost-grey old cat in a nightcap having midnight tea by candlelight in the attic, warm and cozy, storm visible through window",
            "text": "Milo and Great-Grandcat share midnight tea and stories until the storm passes. And peeking out of the teapot — grandma's key! The End!",
        },
        "end_key": {
            "scene": f"{MILO} walking out the front gate holding an ornate golden key glowing warmly, and in the lit window behind him a gentle shadowy figure waving goodbye",
            "text": "Milo asked so nicely that his new friend fetched grandma's key! And as he leaves... something in the window waves goodbye. The End?",
        },
        "end_owls": {
            "scene": f"{MILO} curled among owls in tiny spectacles around a glowing storybook in the library, cozy candlelight",
            "text": "Milo stays for owl story time. The spooky house isn't spooky at all — just full of readers. And Grandpa Owl's bookmark? It's grandma's key! The End!",
        },
        "end_feast": {
            "scene": f"{MILO} and a chef mouse feasting on jam and bread atop a barrel in the glowing cellar, jars lighting the scene like lanterns",
            "text": "A midnight jam feast with Chef Mouse! Milo's whiskers are sticky with strawberry. And Chef Mouse knows JUST where grandma's key is. The End!",
        },
        "end_phantom": {
            "scene": f"{MILO} marching in a proud little parade behind a heron wearing a bedsheet cape through the moonlit garden, hedgehogs following",
            "text": "The Garden Phantom leads a midnight parade — hedgehogs in a line! — and Milo is the lantern-bearer. And look what the Phantom found in the flowers: grandma's key! The End!",
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
            "text": "In Scaring Class, Principal Growlbert teaches BOO 101. Mo's scary face just looks... adorable. The supply closet wobbles — someone tiny in there is giggling too!",
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
            "text": "Blobbina's secret: 'Being scary is just being YOU — your way!' The funhouse mirror behind them darkens...",
            "scare": {"spot": "the darkened funhouse mirror", "pop": "Principal Growlbert the huge shaggy purple monster with glasses stepping out of the mirror-dark holding a juice box",
                      "reveal": "It's just Principal Growlbert on juice break! His shadow is scarier than he is. 'Carry on!'", "sting": "boing", "delay": 0},
            "choices": [{"label": "Try the teeny-tiniest boo 🤫", "next": "end_boo"},
                        {"label": "Scare Principal Growlbert back 😈", "next": "end_growl"}],
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
            "text": "At the big talent show, Mo whispers the tiniest 'boo' ever... and the whole school tumbles over laughing! The giggly closet ghost giggles loudest of all. Scariest Sound winner: MO! The End!",
        },
        "end_team": {
            "scene": f"{MO} and all the cast monsters taking a group bow on stage under a banner of scribbled monster drawings, arms and noodle-arms around each other",
            "text": "Scares are better together! The whole school piles onto the big stage, and Mo and the class take a bow. Best first day ever. The End!",
        },
        "end_growl": {
            "scene": f"Principal Growlbert the huge purple monster leaping in surprise spilling his juice box while tiny {MO} says boo behind him, teachers applauding",
            "text": "Mo sneaks up and — BOO! Principal Growlbert jumps so high his juice goes flying! He laughs until his glasses fog up. Instant legend. The End!",
        },
        "end_pudding": {
            "scene": f"{MO} and the cast monsters in a joyful pudding food-fight in the lunchroom, pudding everywhere, everyone laughing",
            "text": "The tiptoeing trash can tips over — it was FULL of pudding! The Great Pudding Party of Scare School! Even the lunch pot is laughing. The End!",
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
            "text": "Luna found a tiny floating house with two magic doors! The red sun door hums with warm light. The blue moon door twinkles with tiny stars. Which door should Luna open?",
            "choices": [{"label": "Open the red sun door", "next": "a", "spot": "round red door"},
                        {"label": "Open the blue moon door", "next": "b", "spot": "tall blue door"}],
        },
        "a": {
            "scene": f"{LUNA} stepping into a sunny garden in the clouds, golden light everywhere. On the LEFT a shiny GOLDEN spiral slide curling down from a cloud hill, on the RIGHT a giant RED-capped bouncy mushroom with white spots like a trampoline. Both large, fully visible, clearly separated",
            "text": "Behind the red door is a garden in the clouds! A golden slide curls down the hill, and a giant bouncy mushroom goes boing... boing... Where should Luna play?",
            "choices": [{"label": "Whoosh down the golden slide", "next": "aa", "spot": "golden spiral slide"},
                        {"label": "Bounce on the big mushroom", "next": "ab", "spot": "giant red mushroom"}],
        },
        "b": {
            "scene": f"{LUNA} stepping into a magical night garden under swirling stars. On the LEFT a little WOODEN boat glowing with fireflies floating on a starlit pond, on the RIGHT a SILVER crescent-moon swing hanging from a star on silver ropes. Both large, fully visible, clearly separated",
            "text": "Behind the blue door is a night garden full of stars! A firefly boat bobs on the pond, and a silver moon swing sways from a star. What should Luna ride?",
            "choices": [{"label": "Sail the firefly boat", "next": "ba", "spot": "wooden boat"},
                        {"label": "Swing on the moon swing", "next": "bb", "spot": "silver moon swing"}],
        },
        "aa": {
            "scene": f"{LUNA} landing at the bottom of the golden slide in a valley of candy-colored clouds. On the LEFT a RAINBOW ferris wheel made of clouds turning slowly, on the RIGHT a cozy little cloud cottage with a puffing chimney and warm windows. Both large, fully visible, clearly separated",
            "text": "Wheee! The slide lands in a candy-cloud valley. A rainbow ferris wheel spins slowly, and a cozy cloud cottage puffs warm little smoke rings. Where to now?",
            "choices": [{"label": "Ride the rainbow wheel", "next": "end_party", "spot": "rainbow ferris wheel"},
                        {"label": "Knock at the cloud cottage", "next": "end_cozy", "spot": "cloud cottage"}],
        },
        "ab": {
            "scene": f"{LUNA} bouncing high off the giant mushroom toward a treetop village at sunset. On the LEFT a long ROPE bridge with flags leading to a treehouse full of lanterns and party balloons, on the RIGHT a small FLUFFY white cloud with a friendly smiling face floating close by. Both large, fully visible, clearly separated",
            "text": "Boing! Luna bounces all the way up to a treetop village. A flaggy rope bridge leads to a lantern party, and a little smiling cloud floats up beside her. What should Luna do?",
            "choices": [{"label": "Cross the rope bridge", "next": "end_party", "spot": "rope bridge"},
                        {"label": "Hop on the friendly cloud", "next": "end_flight", "spot": "fluffy white cloud"}],
        },
        "ba": {
            "scene": f"{LUNA} in the glowing firefly boat arriving at a tiny island where baby stars sleep. On the LEFT a big soft NEST woven of moonbeams full of dozing glowing baby stars, on the RIGHT a small striped MOON lighthouse with a spiral staircase and a bright lamp. Both large, fully visible, clearly separated",
            "text": "The firefly boat sails to Star Island, where baby stars snore tiny sparkly snores. There's a soft moonbeam nest, and a little striped lighthouse. Where should Luna go?",
            "choices": [{"label": "Snuggle into the star nest", "next": "end_stars", "spot": "nest of baby stars"},
                        {"label": "Climb the little lighthouse", "next": "end_dizzy", "spot": "striped lighthouse"}],
        },
        "bb": {
            "scene": f"{LUNA} swinging up onto a moon balcony made of silver clouds. On the LEFT a big shiny BRASS telescope pointed at the twinkling sky, on the RIGHT a long curly SILVER slide spiraling from the balcony down toward a warm lit meadow far below. Both large, fully visible, clearly separated",
            "text": "The swing carries Luna to a balcony on the moon! A big brass telescope peeks at the stars, and a curly silver slide swooshes all the way home. What should Luna pick?",
            "choices": [{"label": "Peek through the telescope", "next": "end_stars", "spot": "brass telescope"},
                        {"label": "Take the silver slide home", "next": "end_slip", "spot": "silver slide"}],
        },
        "end_dizzy": {
            "scene": "LUNA_DIZZY_PLACEHOLDER",
            "text": "Whoa — the lighthouse lamp is SO bright! Luna goes all dizzy and slides right back down to the boat. Home early, blinking little stars. Oopsie ending!",
            "bad": True,
        },
        "end_slip": {
            "scene": "LUNA_SLIP_PLACEHOLDER",
            "text": "Wheee — TOO fast! The slippery silver slide plops Luna SPLAT into a puddle. Muddy mane! Straight home for a bath. Oopsie ending!",
            "bad": True,
        },
        "end_party": {
            "scene": f"{LUNA} dancing at a joyful cloud carnival with cloud sheep, star bunnies and rainbow birds, ferris wheel and lanterns glowing, confetti of flower petals",
            "text": "Luna dances all evening at the cloud carnival with her new friends. Best. Door. Ever! The End!",
        },
        "end_cozy": {
            "scene": f"{LUNA} curled up by a crackling fireplace inside the cozy cloud cottage, sipping cocoa with marshmallows with a kindly old cloud sheep in spectacles",
            "text": "Warm cocoa, marshmallows, and stories by the fire with Granny Sheep. Luna purrs like a kitten. The End!",
        },
        "end_stars": {
            "scene": f"{LUNA} asleep in the moonbeam nest with glowing baby stars snuggled all around her like a blanket, one baby star on her head",
            "text": "The baby stars snuggle Luna like a sparkly blanket. Shhh... goodnight, Luna. The End!",
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
            "text": "Pip found a treasure map! X marks the spot. The trail splits: a sparkly crystal cave in the cliff, or a wobbly rope bridge over the lagoon. Which way, Pip?",
            "choices": [{"label": "Into the crystal cave", "next": "a", "spot": "dark cave mouth"},
                        {"label": "Across the rope bridge", "next": "b", "spot": "rope bridge"}],
        },
        "a": {
            "scene": f"{PIP} inside a glittering cave lit by friendly green glowworms. On the LEFT a tunnel whose walls sparkle with PURPLE and PINK crystals, on the RIGHT a little RED wooden row boat with oars resting on an underground stream. Both large, fully visible, clearly separated",
            "text": "Inside, glowworms light the cave like tiny lanterns. A crystal tunnel sparkles purple and pink, and a little red row boat rocks on an underground stream. Which way to the treasure?",
            "choices": [{"label": "Through the crystal tunnel", "next": "aa", "spot": "purple crystal tunnel"},
                        {"label": "Row the little red boat", "next": "ab", "spot": "red row boat"}],
        },
        "b": {
            "scene": f"{PIP} in a bright jungle clearing after the bridge. On the LEFT a very tall LOOKOUT palm tree with a rope ladder going up to a small wooden platform, on the RIGHT a thick green jungle VINE hanging like a swing over a mossy gully. Both large, fully visible, clearly separated",
            "text": "The jungle is buzzing and green! A rope ladder climbs a tall lookout palm, and a fat jungle vine swings over the gully. How should Pip go?",
            "choices": [{"label": "Climb the lookout palm", "next": "ba", "spot": "rope ladder"},
                        {"label": "Swing on the jungle vine", "next": "bb", "spot": "green jungle vine"}],
        },
        "aa": {
            "scene": f"{PIP} in a grand treasure chamber deep in the cave. On the LEFT a GOLDEN door with a big crab-shaped lock glowing softly, on the RIGHT a shimmering WATERFALL curtain hiding something sparkly behind it. Both large, fully visible, clearly separated",
            "text": "A secret chamber! A golden door with a crab-shaped lock... and a shimmery waterfall hiding something sparkly. Where's the treasure, Pip?",
            "choices": [{"label": "Open the golden crab door", "next": "end_chest", "spot": "golden door"},
                        {"label": "Peek behind the waterfall", "next": "end_soggy", "spot": "waterfall"}],
        },
        "ab": {
            "scene": f"{PIP} rowing the little red boat across a huge underground lagoon glowing blue. On the LEFT a tiny striped LIGHTHOUSE on a rock with a warm lamp and a waving crab beside it, on the RIGHT a burbling BUBBLE geyser making giant rainbow bubbles rise from the water. Both large, fully visible, clearly separated",
            "text": "The stream opens into a secret glowing lagoon! A tiny lighthouse blinks hello — there's a crab waving! And over there, a geyser burps giant rainbow bubbles. Where to?",
            "choices": [{"label": "Visit the lighthouse crab", "next": "end_friends", "spot": "striped lighthouse"},
                        {"label": "Chase the rainbow bubbles", "next": "end_splash", "spot": "bubble geyser"}],
        },
        "ba": {
            "scene": f"{PIP} on the palm-top lookout platform seeing the whole island. On the LEFT a ZIPLINE with a wooden handle running down toward an old friendly shipwreck on the beach, on the RIGHT a springy COCONUT catapult made of bent palm and vines loaded with one coconut. Both large, fully visible, clearly separated",
            "text": "From the top, Pip sees everything — even an old shipwreck on the beach! A zipline zooms right to it. And... is that a coconut catapult? Choose, Pip!",
            "choices": [{"label": "Ride the zipline", "next": "end_chest", "spot": "zipline"},
                        {"label": "Boing the coconut catapult", "next": "end_boing", "spot": "coconut catapult"}],
        },
        "bb": {
            "scene": f"{PIP} landing with a soft thump on the deck of a friendly old shipwreck. On the LEFT the captain's big round SHIP WHEEL with a paw-print carved in the middle, on the RIGHT a colorful PARROT on a perch wearing a tiny pirate hat, squawking happily. Both large, fully visible, clearly separated",
            "text": "Wheee! Pip lands on a real pirate ship! The captain's wheel has a paw print on it... and a parrot in a tiny hat squawks 'Pieces of kibble! Pieces of kibble!' Who should Pip see?",
            "choices": [{"label": "Spin the captain's wheel", "next": "end_chest", "spot": "ship wheel"},
                        {"label": "Say hi to the parrot", "next": "end_friends", "spot": "parrot"}],
        },
        "end_soggy": {
            "scene": "PIP_SOGGY_PLACEHOLDER",
            "text": "SPLOOSH! Behind the waterfall is... just MORE water. Pip is soaked to the whiskers and the map went all drippy. Home for a warm towel. Oopsie ending!",
            "bad": True,
        },
        "end_boing": {
            "scene": "PIP_BOING_PLACEHOLDER",
            "text": "BOING! The coconut catapult flings Pip aaaall the way back to the start of the beach. Sandy bottom. Zero treasure. Oopsie ending!",
            "bad": True,
        },
        "end_chest": {
            "scene": f"{PIP} opening a huge overflowing treasure chest of golden dog bones, shiny balls and squeaky toys, golden light on his amazed face, confetti",
            "text": "X marks the spot! The chest is full of golden bones and squeaky toys — puppy treasure! Pip is RICH! The End!",
        },
        "end_splash": {
            "scene": f"{PIP} splashing joyfully in the turquoise lagoon with a crab, a parrot and rainbow bubbles everywhere, treasure map floating like a little boat",
            "text": "SPLASH! Best swim ever, with bubbles and new friends. Maybe THIS was the real treasure. (Nah — but it's close!) The End!",
        },
        "end_friends": {
            "scene": f"{PIP} at a beach picnic at sunset with a crab in a chef hat, a parrot in a pirate hat and a gentle whale peeking from the water, sharing sandwiches on a checkered blanket",
            "text": "Crab makes sandwiches, Parrot tells pirate jokes, and Whale sprays a rainbow. Treasure friends forever! The End!",
        },
    },
}
