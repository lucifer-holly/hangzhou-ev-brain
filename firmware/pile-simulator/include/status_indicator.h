// LED / buzzer / servo lock — user-visible state surface.
//
// Kept tiny on purpose: anything more elaborate (animations, beep patterns)
// would distract from the AIoT control loop demo.

#pragma once

namespace hzev {

enum class PileMode {
  Idle,        // no plug, low power, blue LED
  Charging,    // active CC/CV, green LED
  Throttled,   // fuzzy de-rate, yellow LED
  Anomaly,     // anomaly detector tripped, red LED + buzzer
};

void status_init();
void status_update(PileMode mode, bool plug_inserted);

// Buzzer is non-blocking — pass duration in ms; tone plays via ledc.
void status_beep(unsigned int duration_ms = 200);

}  // namespace hzev
