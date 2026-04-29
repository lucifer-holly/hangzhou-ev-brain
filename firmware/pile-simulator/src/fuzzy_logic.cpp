#include "fuzzy_logic.h"

#include <Arduino.h>

namespace hzev {

namespace {

// Triangular membership for {low, mid, high} sets defined by three peaks.
// Returns the three membership values normalised so they sum to 1 (defensive
// against wide tails).
inline void triangular3(float x, float lo, float mid, float hi,
                        float* mu_low, float* mu_mid, float* mu_high) {
  // Below lo → fully "low"; above hi → fully "high"; ramp linearly between.
  float ml = 0.0f, mm = 0.0f, mh = 0.0f;
  if (x <= lo) {
    ml = 1.0f;
  } else if (x < mid) {
    ml = (mid - x) / (mid - lo);
    mm = (x - lo) / (mid - lo);
  } else if (x < hi) {
    mm = (hi - x) / (hi - mid);
    mh = (x - mid) / (hi - mid);
  } else {
    mh = 1.0f;
  }
  const float total = ml + mm + mh;
  if (total > 0.0f) {
    *mu_low  = ml / total;
    *mu_mid  = mm / total;
    *mu_high = mh / total;
  } else {
    *mu_low = 0.0f; *mu_mid = 0.0f; *mu_high = 1.0f;
  }
}

// 27-rule lookup table indexed [cable][cabinet][grid] -> output k singleton.
// Convention: 0 = cool/normal, 1 = warm/elevated, 2 = hot/high.
//
// Hand-crafted with these guiding principles:
//   - Anything "hot" on the cable forces a hard de-rate (cable safety wins).
//   - Cabinet hot triggers a moderate de-rate even if the cable is cool
//     (power electronics protection).
//   - Grid pressure adds a multiplicative effect — cloud-driven peak shaving.
//   - All-cool / all-normal stays at full power.
constexpr float K_LUT[3][3][3] = {
    // cable = Cool
    {
        // cabinet = Cool         Warm         Hot
        { 1.00f, 0.85f, 0.55f },   // grid Normal
        { 0.90f, 0.75f, 0.45f },   // grid Elevated
        { 0.70f, 0.55f, 0.30f },   // grid High
    },
    // cable = Warm
    {
        { 0.85f, 0.70f, 0.45f },
        { 0.75f, 0.60f, 0.40f },
        { 0.55f, 0.45f, 0.25f },
    },
    // cable = Hot
    {
        { 0.40f, 0.30f, 0.20f },
        { 0.30f, 0.25f, 0.15f },
        { 0.20f, 0.15f, 0.05f },
    },
};
// Permuted accessor — the LUT is laid out in [cable][cabinet][grid] order so
// the index expression below matches that layout: LUT[cable][cabinet][grid].

}  // namespace

float FuzzyController::computePowerCoefficient(float cable_temp_c,
                                               float cabinet_temp_c,
                                               float grid_pressure) const {
  // Membership domains chosen against the Wokwi NTC sliders:
  //   cable: Cool peak 25 °C, Warm peak 60 °C, Hot peak 95 °C
  //   cabinet: Cool 30, Warm 60, Hot 100
  //   grid: Normal 0.0, Elevated 0.5, High 1.0 (already in [0, 1])
  float c_low, c_mid, c_high;
  float k_low, k_mid, k_high;
  float g_low, g_mid, g_high;

  triangular3(cable_temp_c, 25.0f, 60.0f, 95.0f, &c_low, &c_mid, &c_high);
  triangular3(cabinet_temp_c, 30.0f, 60.0f, 100.0f, &k_low, &k_mid, &k_high);
  triangular3(grid_pressure, 0.0f, 0.5f, 1.0f, &g_low, &g_mid, &g_high);

  const float cable_w[3]   = { c_low, c_mid, c_high };
  const float cabinet_w[3] = { k_low, k_mid, k_high };
  const float grid_w[3]    = { g_low, g_mid, g_high };

  float k_sum   = 0.0f;
  float w_sum   = 0.0f;
  for (int i = 0; i < 3; ++i) {
    for (int j = 0; j < 3; ++j) {
      for (int g = 0; g < 3; ++g) {
        const float w = cable_w[i] * cabinet_w[j] * grid_w[g];
        k_sum += w * K_LUT[i][j][g];
        w_sum += w;
      }
    }
  }
  if (w_sum <= 0.0f) return 1.0f;
  float k = k_sum / w_sum;
  if (k < 0.0f) k = 0.0f;
  if (k > 1.0f) k = 1.0f;
  return k;
}

}  // namespace hzev
