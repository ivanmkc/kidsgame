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
            "choices": [{"label": "Cross the rope bridge", "next": "end_party_treetop", "spot": "rope bridge"},
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
            "choices": [{"label": "Peek through the telescope", "next": "end_stars_moon", "spot": "brass telescope"},
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
        "end_party_treetop": {
            "scene": f"{LUNA} dancing at a joyful treetop lantern party just across the rope bridge, treehouse village at sunset, paper lanterns and balloons everywhere, cloud sheep and star bunnies dancing along",
            "text": "Across the bridge, the treetop party is ON! Lanterns, balloons, and dancing till the stars peek out. Best. Bridge. Ever! The End!",
        },
        "end_stars_moon": {
            "scene": f"{LUNA} at the big brass telescope on the silver moon balcony while glowing baby stars fly up and snuggle around her shoulders and rainbow mane, twinkling night sky",
            "text": "Through the telescope Luna spots... baby stars! They fly right up to snuggle her on the moon balcony. Goodnight, little stars. The End!",
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
            "choices": [{"label": "Open the golden crab door", "next": "end_chest_cave", "spot": "golden door"},
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
            "text": "SPLOOSH! Behind the waterfall is... just MORE water. Pip is soaked to the whiskers and the map went all drippy. Home for a warm towel. Oopsie ending!",
            "bad": True,
        },
        "end_boing": {
            "scene": "PIP_BOING_PLACEHOLDER",
            "text": "BOING! The coconut catapult flings Pip aaaall the way back to the start of the beach. Sandy bottom. Zero treasure. Oopsie ending!",
            "bad": True,
        },
        "end_chest_cave": {
            "scene": f"{PIP} in a glittering cave treasure chamber, the golden crab-lock door swung wide open behind him, opening a huge treasure chest overflowing with golden dog bones, shiny balls and squeaky toys, crystal light sparkling everywhere",
            "text": "The crab door swings open — and there it is! A chest of golden bones and squeaky toys, deep in the sparkly cave. X marks the spot! The End!",
        },
        "end_chest_wreck": {
            "scene": f"{PIP} on the deck of the friendly old shipwreck, an opened treasure chest overflowing with golden dog bones and squeaky toys beside the captain's wheel, the parrot in a tiny pirate hat cheering, turquoise sea behind",
            "text": "Right there on the pirate ship — the treasure chest! Golden bones, squeaky toys, and a cheering parrot. X marks the spot! The End!",
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
            "text": "Grandma's prize melon is STOLEN — and dawn is only ten lanterns away! The thief left dango paw prints heading two ways. Which way, Detective Milo?",
            "choices": [{"label": "Take the fishy alley", "next": "a", "spot": "red torii gate"},
                        {"label": "Take the sweet lane", "next": "b", "spot": "pink lantern arch"}],
        },
        "a": {
            "scene": f"{MILO} in a moonlit fish alley beside a snoring old fishmonger crumpled asleep across crates, a lucky mackerel-scale charm on the stall counter. On the LEFT a tall stack of GREEN net baskets pinned like a ladder against a wall, on the RIGHT a fat WOODEN pickle barrel with the lid tilted open and paw prints on the rim. Both large, fully visible, clearly separated",
            "text": "The fishmonger snores. Milo pockets a lucky mackerel-scale charm (he'll bring it back!). Up the nets to the rooftops, or down into the pickle warehouse?",
            "choices": [{"label": "Climb the net baskets", "next": "aa", "spot": "green net baskets"},
                        {"label": "Into the pickle barrel", "next": "ab", "spot": "wooden pickle barrel"}],
        },
        "b": {
            "scene": f"{MILO} in the glowing lantern square feeding his last dumpling to a hungry black market CROW that caws happily, dango trail forking. On the LEFT a moonlit JADE garden gate framing glowing jasmine, on the RIGHT a red MOCHI shop archway hung with round pink and white sweets. Both large, fully visible, clearly separated",
            "text": "In the square, a hungry crow eyes Milo's last dumpling. He shares it (kindness pays!) and the crow caws thanks. The trail forks — jasmine garden, or mochi lane?",
            "choices": [{"label": "Into the jasmine garden", "next": "ba", "spot": "jade garden gate"},
                        {"label": "Down the mochi lane", "next": "bb", "spot": "red mochi arch"}],
        },
        "aa": {
            "scene": f"{MILO} crouched on a moonlit tiled rooftop among sleeping market cats, the melon trail smudged toward two places. On the LEFT the tall BLUE bell tower rising over the market with a rope ladder dangling, on the RIGHT a curling column of STEAM from a wooden BATHHOUSE vent between the tiles. Both large, fully visible, clearly separated",
            "text": "On the rooftop, market cats blink hi. The trail smudges two ways: up the blue bell tower rope, or down through the bathhouse steam-vent?",
            "choices": [{"label": "Climb the bell tower", "next": "m1", "spot": "blue bell tower"},
                        {"label": "Slip through the vent", "next": "m2", "spot": "wooden bathhouse vent"}],
        },
        "ab": {
            "scene": f"{MILO} inside a dim pickle warehouse of enormous barrels, glow-fish in jars lighting the shelves. On the LEFT a big BRASS bell-cart stacked with barrels marked TEMPLE, on the RIGHT a low round WOODEN service door with a bathhouse steam-cloud carved above it. Both large, fully visible, clearly separated",
            "text": "Barrels loom, glow-fish jars light the way. Two ways out: a brass bell-cart bound for the temple tower, or the low bathhouse service door?",
            "choices": [{"label": "Hop on the bell cart", "next": "m1", "spot": "brass bell cart"},
                        {"label": "Through the wooden door", "next": "m2", "spot": "wooden bathhouse door"}],
        },
        "ba": {
            "scene": f"{MILO} in a moonlit jasmine garden of glowing white flowers, fireflies drifting, the friendly crow following overhead. On the LEFT a wide RED lacquered courtyard bridge lit by lanterns, on the RIGHT a curved WOODEN koi-pond bridge leading toward glinting wharf water. Both large, fully visible, clearly separated",
            "text": "The jasmine garden hushes. The crow flaps overhead — kindness pays! Two bridges: the red courtyard bridge, or the koi bridge toward the wharf?",
            "choices": [{"label": "Cross the red bridge", "next": "m3", "spot": "red lacquered bridge"},
                        {"label": "Cross the koi bridge", "next": "m4", "spot": "wooden koi bridge"}],
        },
        "bb": {
            "scene": f"{MILO} in a sweet mochi lane of round pink and white shops, dango trail thick as jam, the crow perched cheerfully on a shopfront. On the LEFT a big PURPLE curtain drawn across a courtyard theatre with a mochi cart parked outside, on the RIGHT a rolling YELLOW honey-cart rumbling downhill toward the wharf. Both large, fully visible, clearly separated",
            "text": "The dango trail thickens — the crow lands with a caw and points! Slip under the courtyard theatre curtain, or hop the honey-cart toward the wharf?",
            "choices": [{"label": "Under the curtain", "next": "m3", "spot": "purple theatre curtain"},
                        {"label": "Hop the honey cart", "next": "m4", "spot": "yellow honey cart"}],
        },
        "m1": {
            "scene": f"{MILO} on the top platform of the blue bell tower under a huge bronze bell, moonlight everywhere. On the LEFT a tiny sleeping BABY DRAGON curled around a green melon breathing sparkles, on the RIGHT a dusty rope room with a stack of GOLDEN bell weights and a startled mouse in a chef hat. Both large, fully visible, clearly separated",
            "text": "The tower! And the melon — with a tiny snoring DRAGON curled around it, cheek to the rind. Show the mackerel charm and tiptoe up, or peek at the golden bell weights first?",
            "choices": [{"label": "Show the mackerel charm", "next": "end_bell_dragon", "spot": "sleeping baby dragon"},
                        {"label": "Peek the bell weights", "next": "end_bell_bounce", "spot": "golden bell weights"}],
        },
        "m2": {
            "scene": f"{MILO} on the wooden bathhouse walkway in warm steam, the melon just visible bobbing in the hot spring. On the LEFT the big STEAMY hot pool with a friendly fox spirit gently petting a green melon, on the RIGHT a slippery WHITE tiled floor beside a huge open dark SOY sauce barrel. Both large, fully visible, clearly separated",
            "text": "Steam curls. There's the melon — bobbing beside a friendly fox spirit! Bow politely (charm out) and ask, or skid across the wet tiles to grab it fast?",
            "choices": [{"label": "Bow at the pool", "next": "end_bath_soak", "spot": "steamy hot pool"},
                        {"label": "Skid across tiles", "next": "end_soy_barrel", "spot": "white slippery tiles"}],
        },
        "m3": {
            "scene": f"{MILO} arriving at a moonlit courtyard stage, the CROW landing on his shoulder. In the middle, a small BABY DRAGON caught red-clawed hugging the green melon like an egg, blinking. On the LEFT a heap of GOLD confetti-cannons rigged for the moon festival, on the RIGHT a small STONE dragon shrine with a friendly stone-dragon face. Both large, fully visible, clearly separated",
            "text": "GOTCHA! A baby dragon, hugging the melon like her missing egg. The crow lands helpfully. Pop the gold confetti to celebrate, or bring her to the stone dragon shrine to swap?",
            "choices": [{"label": "Pop the confetti", "next": "end_court_confetti", "spot": "gold confetti cannons"},
                        {"label": "To the dragon shrine", "next": "end_court_reveal", "spot": "stone dragon shrine"}],
        },
        "m4": {
            "scene": f"{MILO} on the wharf under strings of lanterns, the CROW circling above. In the water, the green melon floats past on a leaf-boat paddled by a plump river OTTER. On the LEFT a small ORANGE rowboat tied at the pier with an oar ready, on the RIGHT a big RED koi splashing over a wet plank right beside Milo's paws. Both large, fully visible, clearly separated",
            "text": "The melon is FLOATING — an otter paddles it home in a leaf-boat! The crow caws directions. Row the orange boat after them, or hop the splashy red koi for a shortcut?",
            "choices": [{"label": "Row the orange boat", "next": "end_wharf_otter", "spot": "orange row boat"},
                        {"label": "Leap the splashy koi", "next": "end_koi_splash", "spot": "big red koi"}],
        },
        "end_bell_dragon": {
            "scene": f"{MILO} on the moonlit bell-tower platform, mackerel charm in his paw, a tiny sparkling BABY DRAGON gently placing the green melon into a padded basket while the bronze bell chimes softly, dawn glow beginning",
            "text": "The charm calms her! The dragon-child gives the melon back — 'Sorry, I thought it was my egg!' Dawn bell chimes. Case closed! The End!",
        },
        "end_bell_bounce": {
            "scene": f"{MILO} in the bell-tower rope room with a tumble of GOLDEN bell weights rolling under a very proud mouse chef, the green melon rolling out from a nest of ropes, dawn light through the shutter",
            "text": "The weights TUMBLE — a hidden mouse-chef pantry! And there, packed in ropes for safekeeping: grandma's melon. Mouse chef bows. Case closed! The End!",
        },
        "end_bath_soak": {
            "scene": f"{MILO} bowing beside a friendly FOX SPIRIT at the steamy bathhouse hot spring, the green melon floating between them like a bath toy, mackerel charm glowing softly on the ledge, dawn light",
            "text": "The fox spirit smiles: 'I only wanted to keep it warm — melon soup is best warm!' She hands it over with a wink. Case closed! The End!",
        },
        "end_soy_barrel": {
            "scene": f"{MILO} covered head to whiskers in dark SOY SAUCE splashing from a giant open soy barrel in the bathhouse, wide-eyed startled cats above, no melon in sight",
            "text": "SKIDDDD — SPLOOOOSH! Milo dives straight into the soy barrel. Salty whiskers, no melon. Grandma cheers him up with pickles anyway. Oopsie ending!",
            "bad": True,
        },
        "end_court_reveal": {
            "scene": f"{MILO} at the stone dragon shrine handing the green melon to a small BABY DRAGON as the stone dragon statue lights up glowing, the market CROW perched on Milo's shoulder, dawn glow",
            "text": "The stone dragon glows — the shrine has a real dragon egg waiting inside for her sibling! The melon comes home. Baby dragon smiles wide. Case closed! The End!",
        },
        "end_court_confetti": {
            "scene": f"{MILO} in a burst of GOLD confetti on the moonlit courtyard stage, a joyful BABY DRAGON handing over the green melon, the market CROW flying overhead pulling ribbons, the whole market waking to cheer",
            "text": "BOOM — gold confetti! The whole night market wakes up cheering. The dragon-child gives the melon back and asks to help sell them next week. Case closed! The End!",
        },
        "end_wharf_otter": {
            "scene": f"{MILO} in the little orange rowboat under wharf lanterns beside a plump river OTTER, both grinning as they lift the green melon out of a leaf-boat together at dawn",
            "text": "The otter mistook the melon for a floating snack (fair!). Milo trades half a fish-cracker for it. Melon home in time for grandma's opening. Case closed! The End!",
        },
        "end_koi_splash": {
            "scene": f"{MILO} splashing SPLAT into the koi pond at the wharf, a big red KOI leaping above with a triumphant look, the melon leaf-boat drifting far off toward the dawn horizon",
            "text": "The koi flips — SPLASH! Milo becomes a very wet detective. The melon sails off into the sunrise. Grandma laughs so hard she forgets to be mad. Oopsie ending!",
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
            "text": "A baby glowfish wandered from its tide-pool home! Mo lifts the shell-lantern — a bubble trail forks two ways. The tide returns at dawn. Kelp forest, or coral reef?",
            "choices": [{"label": "Into the kelp forest", "next": "a", "spot": "green kelp forest"},
                        {"label": "Onto the coral reef", "next": "b", "spot": "pink coral arch"}],
        },
        "a": {
            "scene": f"{MO} inside a dim green kelp forest lit by his shell-lantern and a friendly tiny GLOWWORM riding on his nub. On the LEFT a narrow PINK ANEMONE gully bristling with soft glowing anemones, on the RIGHT a huge TAN GIANT clam propped open with a shimmering pearl inside. Both large, fully visible, clearly separated",
            "text": "A little glowworm friend hitches a ride — 'I'll light your way!' Two paths: down the pink anemone gully, or up to the giant clam's pearl light?",
            "choices": [{"label": "Down the gully", "next": "aa", "spot": "pink anemone gully"},
                        {"label": "To the giant clam", "next": "ab", "spot": "tan giant clam"}],
        },
        "b": {
            "scene": f"{MO} on the rainbow coral reef beside a hermit CRAB pouting over an empty shell, receiving a small CORAL HORN for a shiny pebble he traded. On the LEFT a bright ORANGE pufferfish tunnel of round puffed cheeks, on the RIGHT a big GREEN sea turtle drifting close, saddle-shell ready. Both large, fully visible, clearly separated",
            "text": "A glum hermit crab! Mo trades a shiny pebble and — 'A coral horn! Toot for help!' Two paths: the orange pufferfish tunnel, or hop on the sea turtle?",
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
            "scene": f"{MO} up beside the giant clam's pearl, glowworm bright. On the LEFT a mossy GREEN sunken door in the seafloor labelled KELP CAVE, on the RIGHT a colossal WHITE WHALE rib jutting from the sand pointing the way. Both large, fully visible, clearly separated",
            "text": "The clam-pearl lights the whole seafloor! Two ways: through a mossy green door into the kelp cave, or under the white whale rib?",
            "choices": [{"label": "Through the green door", "next": "m1", "spot": "green mossy door"},
                        {"label": "Under the whale rib", "next": "m2", "spot": "white whale rib"}],
        },
        "ba": {
            "scene": f"{MO} floating out of the pufferfish tunnel into open water, coral horn tied to his side. On the LEFT a shimmering PINK JELLY grove of glowing jellyfish drifting like paper lanterns, on the RIGHT a tall PURPLE CORAL castle with turrets rising over the reef. Both large, fully visible, clearly separated",
            "text": "Out the tunnel — WONDER! On one side a jelly grove pulses like paper lanterns. On the other, a purple coral castle with real turrets. Which way?",
            "choices": [{"label": "Into the jelly grove", "next": "m3", "spot": "pink jelly grove"},
                        {"label": "To the coral castle", "next": "m4", "spot": "purple coral castle"}],
        },
        "bb": {
            "scene": f"{MO} on the back of a GREEN sea turtle drifting past two sights, coral horn tied to his side. On the LEFT a huge floating BLUE JELLY crown pulsing softly near a grove, on the RIGHT a wide PURPLE CORAL gate with turrets rising behind. Both large, fully visible, clearly separated",
            "text": "The turtle glides past two sights. A giant blue jelly-crown pulses near the grove; a big purple coral gate leads to a castle. 'Your call, Mo,' says the turtle.",
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
            "text": "Under the whale ribs — the baby's stuck in a net! The whale-ghost hums a lullaby. Glowworm hushes for it. Sing along to loosen the knots, or tug the tangled net free?",
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
            "text": "The coral king holds her — a baby ANGLERFISH, not a jewel! Toot the coral horn to claim her at the golden pearl table, or join the silver dance and let the beat call her home?",
            "choices": [{"label": "Claim at the table", "next": "end_castle_pearl", "spot": "golden pearl table"},
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
            "text": "TOOT — the coral horn! The king bows: 'Ah, your little cousin!' He returns the baby anglerfish on a velvet cushion. Royal escort home. The End!",
        },
        "end_castle_dance": {
            "scene": f"{MO} spinning on the SILVER DANCE floor of the coral castle with a joyful BABY ANGLERFISH twirling on his head, rainbow fish and sea horses dancing all around, coral horn tooting time",
            "text": "The beat drops! Mo and the baby anglerfish twirl until the whole castle joins in. Danced all the way home. Best swim ever. The End!",
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
            "text": "Pip's in the balloon race! First across the bakery finish wins the Cup for Auntie Toast. Two shortcuts: fast-and-tricky cloud tunnel, or safe-and-scenic rainbow bridge?",
            "choices": [{"label": "Into the cloud tunnel", "next": "a", "spot": "white cloud tunnel"},
                        {"label": "Over the rainbow bridge", "next": "b", "spot": "rainbow bridge"}],
        },
        "a": {
            "scene": f"{PIP} in his balloon inside the puffy cloud tunnel, a friendly CLOUD SHEEP handing him a tiny golden WIND-CHARM. On the LEFT a swirling GREEN windmill hill rising through the clouds, on the RIGHT a giant RED rainbow arch made of ribbons overhead. Both large, fully visible, clearly separated",
            "text": "A cloud sheep hands Pip a golden wind-charm — 'For headwinds!' Two ways forward: over the green windmill hill, or under the red rainbow arch?",
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
            "choices": [{"label": "Aim the mountain pass", "next": "m1", "spot": "white mountain pass"},
                        {"label": "Aim the lantern city", "next": "m2", "spot": "gold lantern city"}],
        },
        "ab": {
            "scene": f"{PIP} in his balloon through the red rainbow arch, wind-charm glowing warm. On the LEFT a snowy WHITE mountain gap flashing between two peaks, on the RIGHT a warm ORANGE floating city of paper lanterns swaying on chains. Both large, fully visible, clearly separated",
            "text": "Ribbons whip past the balloon! The wind-charm hums. Two shortcuts appear: the snowy mountain gap, or the warm floating lantern city.",
            "choices": [{"label": "For the mountain gap", "next": "m1", "spot": "white mountain gap"},
                        {"label": "For the lantern city", "next": "m2", "spot": "orange lantern city"}],
        },
        "ba": {
            "scene": f"{PIP} in his balloon drifting past the blue carnival, star-jar tucked in the basket glowing. On the LEFT a big STAR-shaped SILVER balloon station spinning slowly, on the RIGHT a PINK bakery-bluff cliff with a giant iced cupcake on top. Both large, fully visible, clearly separated",
            "text": "Carnival horns cheer! Star-jar glows. Two shortcuts: the spinning silver starfish station, or the pink bakery-bluff with a giant cupcake for a landmark.",
            "choices": [{"label": "To the star station", "next": "m3", "spot": "silver star station"},
                        {"label": "For the bakery bluff", "next": "m4", "spot": "pink bakery bluff"}],
        },
        "bb": {
            "scene": f"{PIP} in his balloon threading between paper kites in the kite tree, star-jar glowing bright. On the LEFT a huge SILVER star-shaped balloon platform spinning, on the RIGHT a warm PINK cliff dusted with flour beneath a big cupcake beacon. Both large, fully visible, clearly separated",
            "text": "Kites tickle the balloon! Star-jar giggles luck. Two shortcuts open: the silver starfish platform ahead, or the pink flour-dusted bakery cliff to the right.",
            "choices": [{"label": "Board the platform", "next": "m3", "spot": "silver star platform"},
                        {"label": "To the pink cliff", "next": "m4", "spot": "pink flour cliff"}],
        },
        "m1": {
            "scene": f"{PIP} in his balloon inside the narrow mountain pass, wind-charm ringing bright. On the LEFT a huge friendly GOLDEN eagle offering a talon-boost, on the RIGHT a SNOWY LEDGE with a whole village of waving snowmen mid-cheer. Both large, fully visible, clearly separated",
            "text": "The mountain howls — the wind-charm sings back! The golden eagle offers a boost. Ride the eagle to the finish, or wave hi to the snowmen first?",
            "choices": [{"label": "Grab the eagle boost", "next": "end_eagle_boost", "spot": "golden eagle"},
                        {"label": "Wave to the snowmen", "next": "end_snow_stall", "spot": "snowy ledge"}],
        },
        "m2": {
            "scene": f"{PIP} in his balloon among lanterns of the floating city, wind-charm steadying the ride. On the LEFT a huge GOLD LANTERN gate marked FINISH twinkling in the wind, on the RIGHT a warm crowd of paper lantern-balloons launching a COLORFUL FIREWORK spray upward. Both large, fully visible, clearly separated",
            "text": "The lantern-city cheers! The wind-charm keeps the balloon steady in gusts. Sail through the gold finish-gate, or ride the firework spray in with a bang?",
            "choices": [{"label": "Through the gold gate", "next": "end_lantern_arrival", "spot": "gold lantern gate"},
                        {"label": "Ride the fireworks", "next": "end_lantern_fireworks", "spot": "colorful firework spray"}],
        },
        "m3": {
            "scene": f"{PIP} in his balloon docking on the silvery starfish balloon station, star-jar glowing bright. On the LEFT a spinning SILVER swirl-launcher that fires balloons like slingshots, on the RIGHT a shimmering RAINBOW confetti geyser bursting straight up. Both large, fully visible, clearly separated",
            "text": "The starfish station spins! Pip's star-jar glows bright — real luck! Aim the silver swirl-launcher toward the bakery, or ride the rainbow confetti geyser up?",
            "choices": [{"label": "Fire the launcher", "next": "end_star_swirl", "spot": "silver swirl launcher"},
                        {"label": "Up the confetti geyser", "next": "end_star_shower", "spot": "rainbow confetti geyser"}],
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
            "scene": f"{PIP} in his balloon gliding through a big glowing GOLD LANTERN gate marked FINISH above the pink bakery, cupcake trophy waiting, floating lantern city cheering behind, sunrise",
            "text": "Straight through the lantern-city finish gate! Every lantern chimes at once. The Cupcake Cup gleams in the morning. Pip WINS! The End!",
        },
        "end_lantern_fireworks": {
            "scene": f"{PIP} in his balloon riding a shower of colorful FIREWORKS across the finish line at the bakery bluff, cupcake trophy sparkling below, sunrise sky exploding with color",
            "text": "BOOM — the firework spray carries Pip up and over the finish! Sparks turn to sprinkles on the Cupcake Cup. Loudest, brightest win ever! The End!",
        },
        "end_star_swirl": {
            "scene": f"{PIP} in his balloon fired by the SILVER SWIRL LAUNCHER spiralling gracefully toward the pink bakery finish, star-jar glowing bright, cupcake trophy waiting, sunrise",
            "text": "SPROING! The silver launcher spins Pip in a perfect spiral to the finish. Star-jar wish granted! The Cupcake Cup is his. The End!",
        },
        "end_star_shower": {
            "scene": f"{PIP} in his balloon covered head to paw in RAINBOW CONFETTI atop the star-station, star-jar sparkling but the pink bakery cliff visible far away, laughing crowd of racing balloons zooming past",
            "text": "WHOOSH — up the geyser! Pip is CONFETTI-COVERED and completely turned around. Star-jar giggles. Second-to-last, but the sparkliest. Oopsie ending!",
            "bad": True,
        },
        "end_bakery_win": {
            "scene": f"{PIP} in his balloon touching down softly on a GIANT white frosted CUPCAKE pedestal at the pink bakery bluff, Auntie Toast the baker cheering with a sprinkle-medal, sunrise",
            "text": "Landing gear down — plop! Right on the giant cupcake. Auntie Toast pins a sprinkle-medal on Pip: 'Take the whole Cupcake Cup home!' The End!",
        },
        "end_bakery_bake": {
            "scene": f"{PIP} standing atop the giant iced cupcake with icing all over his floppy ears, a YELLOW OVEN CHIMNEY puffing warm steam behind him, bakers cheering, sunrise sky",
            "text": "UP the chimney! Pip skids down onto the cupcake and BECOMES the frosting. Icing whiskers, icing tail. Baker's helper of the year! The End!",
        },
    },
}
