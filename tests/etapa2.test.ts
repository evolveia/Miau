import assert from 'node:assert/strict';
import test, { beforeEach, describe } from 'node:test';

// Polyfill lightweight in-memory localStorage for pure Node test runs
const memoryStorage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    get length() {
      return memoryStorage.size;
    },
    clear() {
      memoryStorage.clear();
    },
    getItem(key: string) {
      return memoryStorage.has(key) ? memoryStorage.get(key)! : null;
    },
    key(index: number) {
      return Array.from(memoryStorage.keys())[index] ?? null;
    },
    removeItem(key: string) {
      memoryStorage.delete(key);
    },
    setItem(key: string, value: string) {
      memoryStorage.set(key, String(value));
    },
  } satisfies Storage,
  configurable: true,
});

import {
  HOUSE_ROOMS,
  advanceBathFoamProgress,
  getHouseRoomDef,
  renderRoomInteractiveOverlayHtml,
  renderRoomSwitcherHtml,
} from '../src/services/interactiveRoomsService';
import {
  hasCompletedOnboarding,
  markOnboardingCompleted,
  renderOnboardingOverlayHtml,
  resetOnboarding,
} from '../src/services/onboardingService';
import {
  getEasyReadAudioSpeed,
  isEasyReadEnabled,
  setEasyReadEnabled,
  shouldUseNightModalTheme,
} from '../src/services/accessibilityService';
import {
  renderCollapsibleBottomNavHtml,
  renderCollapsibleSpeechAndChatHtml,
  renderCollapsibleStatusSectionHtml,
} from '../src/services/roomHudLayoutService';
import { renderMiauSvg } from '../src/ui/MiauIllustration';
import type { HouseRoomId } from '../src/types';

beforeEach(() => {
  memoryStorage.clear();
  setEasyReadEnabled(false);
});

describe('Etapa 2.1 - Interactive House Rooms Service', () => {
  test('defines all 5 interactive rooms with unique ids and fallback resolution', () => {
    const ids = HOUSE_ROOMS.map((r) => r.id);
    assert.deepEqual(ids, [
      'living',
      'kitchen',
      'bathroom',
      'bedroom',
      'playroom',
    ]);
    assert.equal(getHouseRoomDef('kitchen').label, 'Cozinha');
    assert.equal(getHouseRoomDef('bathroom').label, 'Banheiro');
    assert.equal(getHouseRoomDef('bedroom').label, 'Quarto');
    assert.equal(getHouseRoomDef('playroom').label, 'Sala de Brincar');
    assert.equal(
      getHouseRoomDef('unknown' as HouseRoomId).id,
      'living'
    );
  });

  test('advances bath foam progress safely within [0, 100]', () => {
    assert.equal(advanceBathFoamProgress(0, 0), 0);
    assert.equal(advanceBathFoamProgress(0, -15), 0);
    const step1 = advanceBathFoamProgress(0, 40);
    assert.ok(step1 > 0 && step1 <= 18);
    assert.equal(advanceBathFoamProgress(95, 80), 100);
    assert.equal(advanceBathFoamProgress(120, 10), 100);
  });

  test('renders room switcher marking the active room with aria-pressed', () => {
    const html = renderRoomSwitcherHtml('bathroom', false);
    assert.match(html, /id="room-switcher-bar"/);
    assert.match(html, /data-room-switch="bathroom"\s+aria-pressed="true"/);
    assert.match(html, /data-room-switch="kitchen"\s+aria-pressed="false"/);
  });

  test('renders room-specific interactive props for kitchen, bathroom, bedroom, and playroom', () => {
    const kitchenClosed = renderRoomInteractiveOverlayHtml({
      activeRoom: 'kitchen',
      petName: 'Miau',
      isSleeping: false,
      isNight: false,
      fridgeOpen: false,
      bathFoamPct: 0,
      lullabyPlaying: false,
      coins: 50,
    });
    assert.match(kitchenClosed, /id="btn-room-fridge"/);
    assert.match(kitchenClosed, /id="btn-room-bowl"/);
    assert.doesNotMatch(kitchenClosed, /id="kitchen-fridge-drawer"/);

    const kitchenOpen = renderRoomInteractiveOverlayHtml({
      activeRoom: 'kitchen',
      petName: 'Miau',
      isSleeping: false,
      isNight: false,
      fridgeOpen: true,
      bathFoamPct: 0,
      lullabyPlaying: false,
      coins: 120,
    });
    assert.match(kitchenOpen, /id="kitchen-fridge-drawer"/);
    assert.match(kitchenOpen, /id="btn-room-all-foods"/);
    assert.match(kitchenOpen, /data-food="/);

    const bathroomHtml = renderRoomInteractiveOverlayHtml({
      activeRoom: 'bathroom',
      petName: 'Miau',
      isSleeping: false,
      isNight: false,
      fridgeOpen: false,
      bathFoamPct: 45,
      lullabyPlaying: false,
      coins: 50,
    });
    assert.match(bathroomHtml, /id="bath-foam-pct">45%</);
    assert.match(bathroomHtml, /id="btn-room-soap"/);
    assert.match(bathroomHtml, /id="btn-room-showerhead"/);
    assert.match(bathroomHtml, /animate-pulse/);

    const bedroomHtml = renderRoomInteractiveOverlayHtml({
      activeRoom: 'bedroom',
      petName: 'Pipoca',
      isSleeping: true,
      isNight: true,
      fridgeOpen: false,
      bathFoamPct: 0,
      lullabyPlaying: true,
      coins: 50,
    });
    assert.match(bedroomHtml, /id="btn-room-lamp"/);
    assert.match(bedroomHtml, /Abajur Apagado/);
    assert.match(bedroomHtml, /id="btn-room-lullaby"/);
    assert.match(bedroomHtml, /Tocando\.\.\./);

    const playroomHtml = renderRoomInteractiveOverlayHtml({
      activeRoom: 'playroom',
      petName: 'Pipoca',
      isSleeping: false,
      isNight: false,
      fridgeOpen: false,
      bathFoamPct: 0,
      lullabyPlaying: false,
      coins: 50,
    });
    assert.match(playroomHtml, /id="btn-room-scratcher"/);
    assert.match(playroomHtml, /id="btn-room-toybox"/);
  });
});

describe('Etapa 2.2 - Miau State Microanimations & SVG Overlays', () => {
  const baseEquipped = { hat: null, accessory: null, background: 'bg_lilac' };

  test('renders dedicated SVG microanimations for each visual effect', () => {
    const chewing = renderMiauSvg('happy', baseEquipped, false, 'chewing');
    assert.match(chewing, /animate-miau-chew/);
    assert.match(chewing, /animate-crumb-fall/);

    const foam = renderMiauSvg('bathing', baseEquipped, false, 'bath_foam');
    assert.match(foam, /#ecfeff/);

    const shake = renderMiauSvg('happy', baseEquipped, false, 'bath_shake');
    assert.match(shake, /animate-miau-shake/);
    assert.match(shake, /animate-droplet-fly/);

    const yawn = renderMiauSvg('sleepy', baseEquipped, false, 'yawning');
    assert.match(yawn, /animate-miau-yawn/);
    assert.match(yawn, />Z</);

    const celebrate = renderMiauSvg('happy', baseEquipped, false, 'celebrating');
    assert.match(celebrate, /animate-miau-celebrate/);
    assert.match(celebrate, /#facc15/);

    const scratch = renderMiauSvg('happy', baseEquipped, false, 'scratching');
    assert.match(scratch, /animate-miau-scratch/);
    assert.match(scratch, /#f97316/);
  });
});

describe('Etapa 2.3 - First-Time Onboarding Tour', () => {
  test('persists completion and supports reset per ownerId', () => {
    const ownerA = 'etapa2-owner-a';
    const ownerB = 'etapa2-owner-b';

    assert.equal(hasCompletedOnboarding(ownerA), false);
    markOnboardingCompleted(ownerA);
    assert.equal(hasCompletedOnboarding(ownerA), true);
    assert.equal(hasCompletedOnboarding(ownerB), false);

    resetOnboarding(ownerA);
    assert.equal(hasCompletedOnboarding(ownerA), false);
  });

  test('renders all 3 onboarding steps and adapts to night mode', () => {
    const step1 = renderOnboardingOverlayHtml({
      step: 1,
      petName: 'Mingau',
      step2ActionDone: false,
      isNight: false,
    });
    assert.match(step1, /Passo 1 de 3/);
    assert.match(step1, /id="onboarding-pet-name-input"/);
    assert.match(step1, /value="Mingau"/);
    assert.match(step1, /id="btn-onboarding-save-name"/);

    const step2Pending = renderOnboardingOverlayHtml({
      step: 2,
      petName: 'Mingau',
      step2ActionDone: false,
      isNight: false,
    });
    assert.match(step2Pending, /Passo 2 de 3/);
    assert.match(step2Pending, /id="btn-onboarding-pet"/);
    assert.match(step2Pending, /id="btn-onboarding-treat"/);
    assert.doesNotMatch(step2Pending, /adorou seu cuidado/);

    const step2Done = renderOnboardingOverlayHtml({
      step: 2,
      petName: 'Mingau',
      step2ActionDone: true,
      isNight: true,
    });
    assert.match(step2Done, /Mingau adorou seu cuidado/);
    assert.match(step2Done, /bg-\[#211844\]\/95/);

    const step3 = renderOnboardingOverlayHtml({
      step: 3,
      petName: 'Mingau',
      step2ActionDone: true,
      isNight: false,
    });
    assert.match(step3, /Passo 3 de 3/);
    assert.match(step3, /id="btn-onboarding-open-learn"/);
    assert.match(step3, /id="btn-onboarding-finish"/);
    assert.match(step3, /id="btn-onboarding-skip"/);
  });
});

describe('Etapa 2.4 - Child Accessibility & Coherent Night Mode', () => {
  test('toggles easyReadMode and forces slow voice playback when active', () => {
    assert.equal(isEasyReadEnabled(), false);
    assert.equal(getEasyReadAudioSpeed(false), false);

    setEasyReadEnabled(true);
    assert.equal(isEasyReadEnabled(), true);
    assert.equal(getEasyReadAudioSpeed(false), true);
    assert.equal(getEasyReadAudioSpeed(true), true);

    setEasyReadEnabled(false);
    assert.equal(isEasyReadEnabled(), false);
    assert.equal(getEasyReadAudioSpeed(false), false);
  });

  test('activates night modal theme when background is nocturnal or Miau is sleeping', () => {
    assert.equal(shouldUseNightModalTheme('bg_night', false), true);
    assert.equal(shouldUseNightModalTheme('bg_space', false), true);
    assert.equal(shouldUseNightModalTheme('bg_lilac', true), true);
    assert.equal(shouldUseNightModalTheme('bg_lilac', false), false);
    assert.equal(shouldUseNightModalTheme('bg_sunny', false), false);
  });
});

describe('Collapsible HUD Panels (Status, Speech/Chat, Bottom Menu)', () => {
  const sampleStats = {
    hunger: 82,
    hygiene: 22,
    fun: 64,
    sleep: 90,
    happiness: 78,
  };

  test('renders expanded and collapsed status panel with compact pills', () => {
    const expanded = renderCollapsibleStatusSectionHtml({
      showStatusBars: true,
      showStatusBadges: true,
      collapsed: false,
      stats: sampleStats,
      unlockedCount: 3,
      totalAchievements: 10,
      routineDone: 2,
      routineTotal: 4,
      activeRoutineCount: 1,
      isSleeping: false,
      level: 5,
    });
    assert.match(expanded, /id="stat-pill-hunger"/);
    assert.match(expanded, /id="stat-pill-happiness"/);
    assert.match(expanded, /id="btn-toggle-status-panel"/);
    assert.match(expanded, /aria-expanded="true"/);

    const collapsed = renderCollapsibleStatusSectionHtml({
      showStatusBars: true,
      showStatusBadges: true,
      collapsed: true,
      stats: sampleStats,
      unlockedCount: 3,
      totalAchievements: 10,
      routineDone: 2,
      routineTotal: 4,
      activeRoutineCount: 1,
      isSleeping: false,
      level: 5,
    });
    assert.match(collapsed, /id="status-collapsed-bar"/);
    assert.match(collapsed, /id="compact-pct-hygiene" class="text-rose-600">22%</);
    assert.match(collapsed, /aria-expanded="false"/);
  });

  test('renders speech and chat boxes independently or combined when collapsed', () => {
    const bothExpanded = renderCollapsibleSpeechAndChatHtml({
      showSpeechAndChat: true,
      collapseSpeechBox: false,
      collapseChatBox: false,
      petName: 'Miau',
      meowPrefix: 'Purrr~',
      speechText: 'Vamos brincar!',
      avatarUrl: '/avatar.png',
      isRecordingMic: false,
    });
    assert.match(bothExpanded, /id="speech-bubble-card"/);
    assert.match(bothExpanded, /id="quick-chat-form"/);
    assert.match(bothExpanded, /id="btn-toggle-speech-box"/);
    assert.match(bothExpanded, /id="btn-toggle-chat-box"/);

    const speechOnlyCollapsed = renderCollapsibleSpeechAndChatHtml({
      showSpeechAndChat: true,
      collapseSpeechBox: true,
      collapseChatBox: false,
      petName: 'Miau',
      meowPrefix: 'Purrr~',
      speechText: 'Vamos brincar!',
      avatarUrl: '/avatar.png',
      isRecordingMic: false,
    });
    assert.match(speechOnlyCollapsed, /id="speech-collapsed-pill"/);
    assert.match(speechOnlyCollapsed, /id="speech-text-compact"/);
    assert.match(speechOnlyCollapsed, /id="quick-chat-form"/);

    const chatOnlyCollapsed = renderCollapsibleSpeechAndChatHtml({
      showSpeechAndChat: true,
      collapseSpeechBox: false,
      collapseChatBox: true,
      petName: 'Miau',
      meowPrefix: 'Purrr~',
      speechText: 'Vamos brincar!',
      avatarUrl: '/avatar.png',
      isRecordingMic: true,
    });
    assert.match(chatOnlyCollapsed, /id="speech-bubble-card"/);
    assert.match(chatOnlyCollapsed, /id="chat-collapsed-pill"/);
    assert.match(chatOnlyCollapsed, /id="btn-mic"/);

    const bothCollapsed = renderCollapsibleSpeechAndChatHtml({
      showSpeechAndChat: true,
      collapseSpeechBox: true,
      collapseChatBox: true,
      petName: 'Pipoca',
      meowPrefix: 'Miau!',
      speechText: 'Olá!',
      avatarUrl: '/avatar.png',
      isRecordingMic: false,
    });
    assert.doesNotMatch(bothCollapsed, /id="speech-bubble-card"/);
    assert.doesNotMatch(bothCollapsed, /id="quick-chat-form"/);
    assert.match(bothCollapsed, /Fala de Pipoca/);
    assert.match(bothCollapsed, /id="btn-speaker"/);
  });

  test('renders bottom 5-option menu in expanded and collapsed states', () => {
    const expanded = renderCollapsibleBottomNavHtml({
      collapsed: false,
      activeModal: 'none',
      isCleaningMode: false,
    });
    assert.match(expanded, /data-nav="feed"/);
    assert.match(expanded, /data-nav="chat"/);
    assert.match(expanded, /id="btn-toggle-bottom-nav"/);
    assert.match(expanded, /aria-expanded="true"/);

    const collapsed = renderCollapsibleBottomNavHtml({
      collapsed: true,
      activeModal: 'none',
      isCleaningMode: false,
    });
    assert.doesNotMatch(collapsed, /data-nav="feed"/);
    assert.match(collapsed, /id="btn-toggle-bottom-nav"/);
    assert.match(collapsed, /aria-expanded="false"/);
    assert.match(collapsed, /Ações do Miau/);
  });
});

