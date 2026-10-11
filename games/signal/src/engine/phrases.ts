/**
 * Our own words for free play and the Daily Signal: short phrases a night operator might send,
 * and a list of everyday words the learning ladders draw from. All ages, no quotations.
 */
export const PHRASES: readonly string[] = [
  'TEA IS READY',
  'THE MOON IS UP',
  'LAMP STILL ON',
  'ALL QUIET HERE',
  'RAIN BY MORNING',
  'BRING A SCARF',
  'THE TRAIN IS LATE',
  'MEET AT THE CLOCK',
  'BOAT IN THE HARBOUR',
  'STARS OVER THE CITY',
  'KEEP THE KETTLE WARM',
  'SNOW ON THE HILLS',
  'THE BRIDGE IS OPEN',
  'FOG ROLLING IN',
  'WIND FROM THE WEST',
  'LIGHTS IN THE TOWER',
  'TWO SHIPS PASSING',
  'BREAKFAST AT SIX',
  'THE CAT IS ASLEEP',
  'NEW BATTERIES PLEASE',
  'BIRDS ON THE WIRE',
  'THE POST HAS COME',
  'OPEN THE WINDOW',
  'THE TIDE IS TURNING',
  'BEES IN THE GARDEN',
  'THE BAKERY IS OPEN',
  'MAPS ARE IN THE DRAWER',
  'CLOCKS GO FORWARD',
  'SEND MORE PAPER',
  'THE PIANO IS TUNED',
  'A FOX IN THE YARD',
  'WARM BREAD FOR ALL',
  'THE OWL IS AWAKE',
  'PACK A LANTERN',
  'MUSIC AT NOON',
  'THE LIBRARY IS QUIET',
  'NEW MOON TONIGHT',
  'LEAVES ARE FALLING',
  'HONEY IN THE JAR',
  'THE KITE IS FLYING',
  'BICYCLE BELL RINGS',
  'GOOD MORNING DESK',
  'THE RIVER IS HIGH',
  'APPLES ON THE TABLE',
  'STAY FOR SUPPER',
  'THE BUS IS FULL',
  'LOOK AT THE SKY',
  'A LETTER FOR YOU',
  'THE GATE IS SHUT',
  'PEAR TREE IN BLOOM',
  'ROOF NEEDS A TILE',
  'COCOA BY THE FIRE',
  'THE FERRY LEAVES SOON',
  'A RAINBOW AT DUSK',
  'SOUP ON THE STOVE',
  'FIND THE BLUE DOOR',
  'THE LIGHTHOUSE BLINKS',
  'COUNT THE STARS',
  'THE PARADE IS TODAY',
  'SAVE A SEAT',
  'MITTENS ON THE HOOK',
  'THE ZEBRA CROSSING',
  'JUGGLE THREE BALLS',
  'QUICK BROWN FOX',
  'A JAM SANDWICH',
  'THE VIOLIN SINGS',
  'WAX THE SLED',
  'TOAST AND JAM',
  'THE CLOCK STRUCK TEN',
  'SHELLS ON THE SAND',
  'THE KNOT HOLDS',
  'A PARCEL ARRIVED',
  'PAINT THE FENCE',
  'THE COMET RETURNS',
  'GLOVES ARE DRY',
  'THE MILL WHEEL TURNS',
  'BOOTS BY THE DOOR',
  'A SONG FOR THE ROAD',
  'THE GARDEN IS WET',
  'FERNS IN THE SHADE',
  'NIGHT SHIFT BEGINS',
  'DAWN IS NEAR',
  'THE SIGNAL IS CLEAR',
  'WIRE IS HUMMING',
  'CARDS IN THE BOX',
  'TAPE ON THE REEL',
  'FLAGS AT THE READY',
  'THE WHEEL CLICKS',
  'A NOTE IN THE DRAWER',
  'ECHO IN THE HALL',
  'THE STAIRS CREAK',
  'BUTTONS ON THE COAT',
  'THE SEA IS CALM',
  'A KITE IN A TREE',
  'MARBLES IN A JAR',
  'THE DOG WANTS A WALK',
  'MUD ON THE BOOTS',
  'PANCAKES ON SUNDAY',
  'THE TENT IS UP',
  'A WALTZ AT NINE',
  'PLUMS ARE RIPE',
  'THE OVEN IS HOT',
  'CANDLES ON THE CAKE',
  'A MAP OF THE STARS',
  'THE ROBIN IS BACK',
  'HATS OFF INDOORS',
  'THE CANAL IS FROZEN',
  'OYSTERS AND OARS',
  'A QUILT FOR WINTER',
  'THE CRANE LIFTS',
  'SIX GEESE FLYING',
  'THE YACHT IS IN',
  'WOOL FOR A JUMPER',
  'THE BELL TOWER',
  'HALF PAST SEVEN',
];

/** Everyday words for the ladders, which pick those spelled only with the letters learned. */
export const WORDS: readonly string[] = (
  'a am an and ant are art as at ate be bed bee bell best big bird boat book box boy bus but by ' +
  'cake call can cap car cat city clock cold come cook cow cup cut dad day den desk did dime dine ' +
  'do does dog done door dot down draw dream dress drew drop dry duck dust each ear east eat egg ' +
  'end eye face fan far farm fast fat feet fish fit five fix flag fly fog for fox frog from fun ' +
  'game gate get gift girl give go goat gold good got gum had ham hand hat have he head hear heat ' +
  'hen her here hid hill him his hit home hood hope horn horse hot hug hut i ice ink inn into is ' +
  'it its jam jar jet job jog joke jump just keep kept key kid kind king kit kite lamp land last ' +
  'late lid lift like line lion lip list lit log long look lost lot loud low mad made main man ' +
  'map mat me meat meet men met mice mind mine mint miss mist mix mom moon more most moth much ' +
  'mud my name near neat neck need nest net new nine no nod none noon nose not note now nut oak ' +
  'oar oat odd of off oil old on one onto open or our out owl own pan park part past pat pen pet ' +
  'pie pig pin pit plan play pot quiet quit quiz rain ram ran rat read red rest ride ring road ' +
  'roam roar rod roof room root rope rose rot row rug run sad said sail salt same sand sat saw ' +
  'say sea seat see seen send sent set she ship shoe shop shot side sign sing sit six sky sled ' +
  'slow snow so sock soft some son song soon sort soup star stem step stir stone stop storm ' +
  'stream sun swim tan tap tea team tear ten tent test the them then there these they thin this ' +
  'tide time tin tip to toad toe told tone too top toss town toy train tree trim trip tune two up ' +
  'us van vase vest vine wade wait walk wall want warm was wash wax way we web well went west wet ' +
  'when win wind wing wire wise wish with wood wool word work yak yam yard yarn yes yet you zip zoo'
)
  .split(' ')
  .map((word) => word.toUpperCase());
