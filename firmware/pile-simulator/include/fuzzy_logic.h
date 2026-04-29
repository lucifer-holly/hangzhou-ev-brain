// Fuzzy-logic safety governor (spec §4.4).
//
// Three inputs (cable_temp, cabinet_temp, grid_pressure) → one output
// (power coefficient k ∈ [0, 1]).  Each input gets three triangular sets
// {Cool, Warm, Hot} for temperatures or {Normal, Elevated, High} for grid;
// the cartesian product yields 27 rules, encoded as a 3×3×3 LUT.
//
// At runtime we compute membership weights per input, then take the weighted
// sum (centroid defuzzification) over the LUT — equivalent to Mamdani
// inference with singleton consequents.

#pragma once

namespace hzev {

class FuzzyController {
 public:
  // grid_pressure is a 0..1 scalar (broadcast by cloud via system/grid/alert
  // → recommended_kfactor, inverted: high pressure ⇒ low k).  When the cloud
  // sends nothing, set it to 0 (= grid normal).
  float computePowerCoefficient(float cable_temp_c,
                                float cabinet_temp_c,
                                float grid_pressure) const;
};

}  // namespace hzev
