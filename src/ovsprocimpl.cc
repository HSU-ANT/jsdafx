#include <cstdlib>
#include <cmath>
#include <vector>

#include "emscripten/bind.h"

class OvsImpl {
public:
  int L;
  float q;
  OvsImpl() : L(1), q(0.25f), ditherfunc(dither_none) { }
  void processBlock(int channel, int size);
  int getDither() const;
  void setDither(int type);
  int getNsN() const { return nsh.size(); };
  void setNsN(int N);
  emscripten::val workbuffer(int size) {
    if (workbuf.size() < size) {
      workbuf.resize(size);
    }
    return emscripten::val(emscripten::typed_memory_view(size, workbuf.data()));
  }
private:
  class State {
  public:
      float prevInput;
      float dither;
      std::vector<float> ns;
      State() : prevInput(0.f), dither(0.f) {}
  };
  static float dither_none(State& s) { return 0.f; };
  static float dither_rect(State& s) { return rand() / ((float) RAND_MAX) - 0.5f; }
  static float dither_tri(State& s) { return (rand() - rand()) / ((float) RAND_MAX); }
  static float dither_hp(State& s);
  float processSample(State& s, float in);
  float (*ditherfunc)(State&);
  std::vector<float> nsh;
  std::vector<State> states;
  std::vector<float> workbuf;
};

int OvsImpl::getDither() const {
  if (ditherfunc == dither_rect) {
    return 1;
  } else if (ditherfunc == dither_tri) {
    return 2;
  } else if (ditherfunc == dither_hp) {
    return 3;
  } else {
    return 0;
  }
}

void OvsImpl::setDither(int type) {
  switch(type) {
    case 1:
    ditherfunc = dither_rect;
    break;
    case 2:
    ditherfunc = dither_tri;
    break;
    case 3:
    ditherfunc = dither_hp;
    break;
    default:
    ditherfunc = dither_none;
  }
}

void OvsImpl::setNsN(int N) {
  switch(N) {
    case 1:
    nsh = {1};
    break;
    case 2:
    nsh = {2, -1};
    break;
    case 3:
    nsh = {1.623, -0.982, 0.109};
    break;
    case 5:
    nsh = {2.033, -2.165, 1.959, -1.590, 0.6149};
    break;
    case 9:
    nsh = {2.412, -3.370, 3.937, -4.174, 3.353, -2.205, 1.281, -0.569, 0.0847};
    break;
    default:
    nsh.resize(0);
  }
}

void OvsImpl::processBlock(int channel, int size)
{
  if (this->states.size() <= channel) {
    this->states.resize(channel+1);
  }
  states[channel].ns.resize(nsh.size(), 0.f);

  for (int n = 0; n < size; n++) {
    workbuf[n] = processSample(states[channel], workbuf[n]);
  }
}

float OvsImpl::processSample(State& state, float in) {
  float out = 0.f;
  for (int k = 0; k < L; k++) {
      float input = (in - state.prevInput) * k/L + state.prevInput;
      state.prevInput = in;

      for (int i = 0; i < nsh.size(); i++) {
        input -= nsh[i] * state.ns[i];
      }

      float d_rand = ditherfunc(state);
      float xr = input;
      float tmpOutput = q * round(xr/q + d_rand);
      for (int i = state.ns.size()-1; i > 0; i--) {
          state.ns[i] = state.ns[i-1];
      }
      if (state.ns.size() > 0) {
        state.ns[0] = tmpOutput - input;
      }

      out += tmpOutput;
  }
  return out / L;
}

float OvsImpl::dither_hp(State& s)
{
    float rnd = rand() / ((float) RAND_MAX) - 0.5f;
    float d = rnd - s.dither;
    s.dither = rnd;
    return d;
}

EMSCRIPTEN_BINDINGS(CLASS_OvsImpl) {
  emscripten::class_<OvsImpl>("OvsImpl")
    .constructor()
    .function("processBlock", &OvsImpl::processBlock)
    .function("workbuffer", &OvsImpl::workbuffer)
    .property("L", &OvsImpl::L)
    .property("q", &OvsImpl::q)
    .property("dither", &OvsImpl::getDither, &OvsImpl::setDither)
    .property("nsN", &OvsImpl::getNsN, &OvsImpl::setNsN);
}
