import type { PassengerArchetype, TaxiDefinition } from './types';

/** Shared coachwork and collider dimensions; includes the bus/van's longer body. */
export function getTrafficDimensions(variant: number): { width: number; length: number; bodyHeight: number } {
  const kind = variant % 5;
  return { width: kind === 3 ? 2.5 : 2.05, length: kind === 3 ? 7.2 : kind === 4 ? 5.6 : 4.3, bodyHeight: kind === 3 ? 2.6 : kind === 4 ? 2 : 1.15 };
}

export const TAXIS: TaxiDefinition[] = [
  { id: 'gull', name: 'GULL COMPACT', tagline: 'Cut corners. Catch air.', description: 'A light, lively three-door with eager turn-in and a playful rear axle. Own the tight streets.', color: '#f5c64f', topSpeed: 158, acceleration: 7.8, handling: 94, drift: 94, mass: 1050, wheelbase: 2.55 },
  { id: 'breaker', name: 'BREAKER SEDAN', tagline: 'The city is your circuit.', description: 'Clean balance, generous grip and a wide power band. Your first great shift starts here.', color: '#f27b50', topSpeed: 172, acceleration: 7.5, handling: 83, drift: 82, mass: 1350, wheelbase: 2.9 },
  { id: 'tempest', name: 'TEMPEST WAGON', tagline: 'Carry momentum. Make waves.', description: 'A planted long-roof with muscle for the boulevard and composed landings. Fast lines pay.', color: '#68d4ce', topSpeed: 180, acceleration: 6.8, handling: 72, drift: 69, mass: 1700, wheelbase: 3.1 },
];
const people: Array<[string, string, PassengerArchetype['preference'], string, string, string, string]> = [
  ['Mika', 'Bicycle messenger', 'speed', 'Beat the tram and the tip is yours!', 'You just made my whole route.', 'Keep that momentum!', 'That parcel was insured. I think.'],
  ['Sol', 'Sunset photographer', 'scenic', 'The light is perfect. Let us find it.', 'That view was worth the ride.', 'Hold that angle!', 'A little less camera shake!'],
  ['Juno', 'Club drummer', 'chain', 'Give this ride a rhythm.', 'You found the pocket!', 'Keep the beat going!', 'We lost the rhythm!'],
  ['Bo', 'Botanical courier', 'clean', 'These flowers have a very big night.', 'Not a petal out of place.', 'Those plants love a breeze.', 'Easy with the orchids!'],
  ['Rafi', 'Kite designer', 'style', 'Can this cab fly?', 'That was a proper test flight!', 'More lift! More lift!', 'Turbulence, huh?'],
  ['Nia', 'Night baker', 'speed', 'My dough is on a timer too.', 'Just in time for the first batch!', 'Now we are cooking.', 'Mind the sourdough!'],
  ['Elio', 'Marine biologist', 'scenic', 'The harbor route, if you can.', 'A wonderful little migration.', 'Beautiful maneuver!', 'I felt that in my gills.'],
  ['Tess', 'Vinyl collector', 'clean', 'Precious cargo. Original pressings.', 'A very smooth track.', 'That had some swing.', 'No scratching the records!'],
  ['Ivo', 'Stunt performer', 'style', 'Show me the interesting way.', 'I would do that again.', 'Now that is an entrance!', 'We can work with that take.'],
  ['Paz', 'Museum guide', 'scenic', 'There is history around every turn.', 'One more story for the tour.', 'An expressive line!', 'That wall is not an exhibit.'],
  ['Remy', 'Tram conductor', 'speed', 'My tram leaves in a minute!', 'All aboard, right on time.', 'Try that on rails!', 'I will stick to tracks.'],
  ['Aya', 'Jazz trumpeter', 'chain', 'Let us make some noise.', 'A standing ovation for you.', 'There is the hook!', 'Wrong note!'],
  ['Kit', 'Beach lifeguard', 'speed', 'The tide waits for nobody.', 'Perfect timing, driver.', 'That is a strong current!', 'Watch the breakwater!'],
  ['Bex', 'Miniature artist', 'clean', 'My models are smaller than your mirrors.', 'Every tiny chimney survived.', 'Steady hands!', 'There goes a tiny chimney.'],
  ['Oren', 'Street magician', 'style', 'Surprise me with a shortcut.', 'How did you do that?', 'Now you see me!', 'That was not misdirection.'],
  ['Luz', 'Glass sculptor', 'clean', 'Gentle turns, glowing reviews.', 'Clear as crystal. Thank you.', 'A delicate balance.', 'Glass remembers everything.'],
  ['Fenn', 'Mountain runner', 'style', 'Take the steep way!', 'That got the heart going.', 'Another summit!', 'A little bump in the trail.'],
  ['Rin', 'Food critic', 'speed', 'The table is waiting.', 'Five stars for the journey.', 'That is some heat.', 'Too much crunch!'],
  ['Alma', 'Garden architect', 'scenic', 'The terraces are lovely today.', 'A beautifully composed ride.', 'Nice use of space!', 'Please mind the greenery.'],
  ['Oz', 'Radio host', 'chain', 'Galeport, we are on the move!', 'That ride deserves airtime.', 'Do not touch that dial!', 'We will edit that bit out.'],
  ['Cleo', 'Festival dancer', 'chain', 'Find us a little flow.', 'Every corner had a groove.', 'Yes! Keep it moving!', 'Missed a step there.'],
  ['Dara', 'Ferry engineer', 'clean', 'The ferry needs its smallest bolt.', 'All parts present. Lovely.', 'Good balance, captain.', 'That is a rough sea.'],
  ['Vik', 'Surf coach', 'style', 'Ride the streets like a wave.', 'You caught a good one!', 'Stay on that line!', 'Little wipeout. Shake it off.'],
  ['Uma', 'Observatory intern', 'scenic', 'Eyes on the road. Mine are on the sky.', 'A stellar arrival.', 'We have liftoff!', 'An unexpected orbit change.'],
];
const colors = ['#e87a58', '#62cbd1', '#cf9bea', '#a9d968', '#f8ca65', '#7b9ddb'];
export const PASSENGER_ARCHETYPES: PassengerArchetype[] = people.map(([name, role, preference, pickupLine, arrivalLine, styleLine, collisionLine], id) => ({ id, name, role, preference, color: colors[id % colors.length], pickupLine, arrivalLine, styleLine, collisionLine }));
export const LESSONS = [
  { title: 'FIRST LIGHT', description: 'Hold W or the right trigger. Reach 70 km/h on Stormway.', objective: 'Reach 70 km/h', target: 70 },
  { title: 'ON A DIME', description: 'Reach 50 km/h, then hold S or the left trigger to stop.', objective: 'Brake from 50 km/h', target: 1 },
  { title: 'SURGE START', description: 'At low speed, release the brake and tap throttle immediately. The timing window is generous: 220 ms.', objective: 'Perform one Surge Start', target: 1 },
  { title: 'LET IT SLIDE', description: 'Above 35 km/h, steer and tap Space or A. Keep throttle on to hold your drift.', objective: 'Bank a 1.2 second drift', target: 1.2 },
  { title: 'GRIP TURN', description: 'During a drift, tap brake then return to throttle to tighten your line.', objective: 'Perform one Grip Turn', target: 1 },
  { title: 'CLOSE CALL', description: 'Pass traffic closely above 50 km/h without touching. Watch the lane ahead.', objective: 'Score a Near Miss', target: 1 },
  { title: 'CATCH THE WIND', description: 'Follow the marker to the ferry ramp. Hit the ramp above 45 km/h and land cleanly.', objective: 'Land a jump', target: 1 },
  { title: 'LOCAL KNOWLEDGE', description: 'Follow the cyan gates through Container Run. Enter the first gate and leave through the second.', objective: 'Discover a shortcut', target: 1 },
  { title: 'PERFECT ARRIVAL', description: 'Collect your passenger, then stop in the center of the destination ring below 8 km/h.', objective: 'Make a precise delivery', target: 1 },
  { title: 'THE WHOLE RIDE', description: 'Pick up, drive the route, and deliver. The city is yours after this.', objective: 'Complete a fare', target: 1 },
];
export const TRIALS = [
  { name: 'HARBOR HUSTLE', description: 'A fast introduction along the waterfront.', destinations: [0, 20, 1], gold: 115, silver: 150, bronze: 195, seed: 73411 },
  { name: 'SUNWARD EXPRESS', description: 'Long coastal lines and a hotel forecourt.', destinations: [31, 2, 7], gold: 150, silver: 185, bronze: 225, seed: 98103 },
  { name: 'CROWN CONNECTION', description: 'Climb the terraces and cross Civic Crown.', destinations: [10, 22, 5], gold: 145, silver: 185, bronze: 230, seed: 51829 },
  { name: 'LANTERN AFTERNOON', description: 'A tight route through the western markets.', destinations: [11, 6, 25, 17], gold: 170, silver: 210, bronze: 240, seed: 13577 },
  { name: 'SKYLINE SPRINT', description: 'Find your flow between the elevated districts.', destinations: [21, 28, 9, 18], gold: 180, silver: 220, bronze: 240, seed: 61049 },
  { name: 'GALEPORT GRAND TOUR', description: 'A full city circuit for a confident driver.', destinations: [20, 12, 4, 29, 14], gold: 190, silver: 225, bronze: 240, seed: 99241 },
];
