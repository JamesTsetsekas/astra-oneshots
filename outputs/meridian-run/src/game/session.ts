import RAPIER from "@dimforge/rapier3d-compat";
import { ArcadeVehicle, initializePhysics, FIXED_DT } from "./vehicle";
import { CONTACTS, MISSIONS, SAFEHOUSE, VEHICLES, WEAPONS } from "./content";
import {
  blocked,
  districtAt,
  findRoute,
  heightAt,
  INTERIORS,
  lineClear,
  ROAD_X,
  ROAD_Z,
} from "./world";
import {
  EMPTY_INPUT,
  type AlertState,
  type Crime,
  type Enemy,
  type GameEvent,
  type InputFrame,
  type Mission,
  type MissionResult,
  type Pedestrian,
  type Player,
  type SaveGame,
  type Settings,
  type Snapshot,
  type Vec2,
  type WorldVehicle,
  type WeaponId,
} from "./types";
const distance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z),
  clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export class GameSession {
  readonly player: Player;
  readonly vehicles: WorldVehicle[] = [];
  readonly pedestrians: Pedestrian[] = [];
  readonly enemies: Enemy[] = [];
  readonly completed: string[] = [];
  readonly results: MissionResult[] = [];
  readonly crimes: Crime[] = [];
  readonly alert: AlertState = {
    tier: 0,
    heat: 0,
    state: "Unnoticed",
    lastKnown: { ...SAFEHOUSE },
    unseen: 0,
  };
  time = 0;
  mission?: Mission;
  result?: MissionResult;
  private physics: ArcadeVehicle;
  private chassisId = 0;
  private char: RAPIER.RigidBody;
  private charCollider: RAPIER.Collider;
  private controller: RAPIER.KinematicCharacterController;
  private events: GameEvent[] = [];
  private counter = 0;
  private previous: InputFrame = { ...EMPTY_INPUT };
  private shotCooldown = 0;
  private lastHurt = -20;
  private lastCrime = -20;
  private lastPolice = -20;
  private accumulator = 0;
  private route: Snapshot["route"] = [];
  private routeAt = 0;
  private smokeUntil = 0;
  private interactions = 0;
  private seed = 8675309;
  private disposed = false;
  private nextWave = 0;
  static async create(settings: Settings, save?: SaveGame) {
    await initializePhysics();
    return new GameSession(settings, save);
  }
  private constructor(
    private settings: Settings,
    save?: SaveGame,
  ) {
    this.player = save
      ? {
          ...save.player,
          vehicleId: undefined,
          dead: false,
          vertical: 0,
          health: Math.max(35, save.player.health),
          grounded: true,
        }
      : {
          x: -184,
          y: heightAt(-184, -300),
          z: -300,
          heading: 0,
          speed: 0,
          health: 100,
          armor: 30,
          stamina: 8,
          cash: 180,
          trust: 0,
          weapon: "stun",
          ammo: 8,
          reserve: 56,
          reload: 0,
          medkits: 2,
          gadgets: 3,
          crouching: false,
          aiming: false,
          holstered: true,
          vertical: 0,
          grounded: true,
          dead: false,
        };
    if (save) {
      if (save.alert)
        Object.assign(this.alert, save.alert, {
          lastKnown: { ...save.alert.lastKnown },
          state: save.alert.tier ? "Search" : "Unnoticed",
          unseen: 0,
        });
      this.completed.push(...save.completed);
      this.results.push(...save.results);
      this.time = save.time;
      this.mission = save.mission
        ? { ...save.mission, progress: 0, fail: undefined }
        : undefined;
    }
    this.spawnWorld();
    this.physics = new ArcadeVehicle(VEHICLES[6], -174, -298, 0);
    this.char = this.physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
        this.player.x,
        this.player.y + 0.87,
        this.player.z,
      ),
    );
    this.charCollider = this.physics.world.createCollider(
      RAPIER.ColliderDesc.capsule(0.5, 0.33),
      this.char,
    );
    this.controller = this.makeController();
    if (!save) this.startMission("first-shift");
    else {
      if (save.mission) {
        this.startMission(save.mission.id, save.mission.replay);
        this.mission = { ...save.mission, progress: 0, fail: undefined };
      }
      if (save.vehicle) {
        const v = this.vehicles.find(
          (v) => v.definition === save.vehicle!.definition,
        );
        if (v)
          Object.assign(v, save.vehicle, {
            y: heightAt(save.vehicle.x, save.vehicle.z),
            parked: true,
            owned: save.vehicle.owned ?? v.owned,
            stolen: save.vehicle.stolen ?? v.stolen,
          });
      }
      this.event("info", "Checkpoint restored. Welcome back to South Quay.");
    }
  }
  private makeController() {
    const c = this.physics.world.createCharacterController(0.025);
    c.enableAutostep(0.55, 0.25, true);
    c.enableSnapToGround(0.3);
    c.setMaxSlopeClimbAngle(Math.PI / 3);
    return c;
  }
  private random() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  private spawnWorld() {
    const add = (
      definition: string,
      x: number,
      z: number,
      heading = 0,
      owned = false,
      parked = true,
    ) => {
      const d = VEHICLES.find((v) => v.id === definition)!;
      const id = this.vehicles.length;
      this.vehicles.push({
        id,
        definition,
        x,
        y: heightAt(x, z),
        z,
        heading,
        speed: 0,
        variant: d.kind === "van" ? 4 : d.kind === "police" ? 2 : id % 3,
        color: d.color,
        state: "cruise",
        condition: 100,
        locked: false,
        owned,
        parked,
        driver: parked ? "none" : "civilian",
        stolen: false,
      });
    };
    add("needle", -174, -298, 0, true);
    add("current", -173, -332, 0, true);
    add("parcel", 184, 84, Math.PI);
    add("skiff", 370, -310, Math.PI / 2);
    add("mistral", 189, -260, 0);
    add("lumen", -10, -252, 0);
    add("sable", 170, 40, Math.PI);
    add("interceptor", 370, 70, Math.PI);
    this.vehicles[7].locked = false;
    const count = Math.round(25 * this.settings.traffic);
    for (let i = 0; i < count; i++) {
      const row = i % 5,
        col = Math.floor(i / 5) % 5;
      add(
        VEHICLES[i % 6].id,
        ROAD_X[col] + (i % 2 ? 4 : -4),
        ROAD_Z[row] + 40 + i * 3,
        i % 2 ? 0 : Math.PI,
        false,
        false,
      );
    }
    for (let i = 0; i < Math.round(46 * this.settings.crowds); i++) {
      const x = ROAD_X[i % 5] + (i % 2 ? 16 : -16),
        z = -375 + ((i * 47) % 750);
      this.pedestrians.push({
        id: i,
        x,
        y: heightAt(x, z),
        z,
        heading: i % 2 ? 0 : Math.PI,
        role: [
          "commuter",
          "dock worker",
          "vendor",
          "tourist",
          "resident",
          "musician",
        ][i % 6],
        color: [
          "#a3624e",
          "#859987",
          "#bfaa7f",
          "#587b8d",
          "#b18b90",
          "#566361",
        ][i % 6],
        state: i % 7 === 0 ? "talk" : i % 9 === 0 ? "work" : "walk",
        phase: this.random() * 9,
        report: 0,
        home: { x, z },
        goal: { x, z: z + (i % 2 ? 80 : -80) },
      });
    }
  }
  private event(
    kind: GameEvent["kind"],
    text: string,
    position?: GameEvent["position"],
    end?: GameEvent["end"],
    value?: number,
  ) {
    this.events.push({
      id: ++this.counter,
      time: this.time,
      kind,
      text,
      position,
      end,
      value,
    });
    if (this.events.length > 36) this.events.shift();
  }
  step(input: InputFrame, dt: number) {
    if (this.disposed) return;
    this.accumulator += Math.min(0.2, dt);
    while (this.accumulator >= FIXED_DT) {
      this.fixed(input);
      this.accumulator -= FIXED_DT;
    }
  }
  private fixed(input: InputFrame) {
    if (this.result || this.player.dead || this.mission?.fail) return;
    const dt = FIXED_DT;
    this.time += dt;
    if (this.player.dead) {
      this.previous = { ...input };
      return;
    }
    const p = this.player;
    this.updateTraffic(dt);
    this.updatePeople(dt);
    this.updatePolice(dt);
    if (input.interact && !this.previous.interact) this.interact();
    if (input.exit && !this.previous.exit) {
      if (p.vehicleId !== undefined) this.exitVehicle();
      else this.interact();
    }
    if (input.heal && !this.previous.heal && p.medkits > 0 && p.health < 100) {
      p.medkits--;
      p.health = Math.min(100, p.health + 60);
      this.event("pickup", "Medical kit used.");
    }
    if (input.gadget && !this.previous.gadget && p.gadgets > 0) {
      p.gadgets--;
      this.smokeUntil = this.time + 9;
      this.event("info", "Smoke screen deployed. Break line of sight.", {
        x: p.x,
        y: p.y + 0.6,
        z: p.z,
      });
    }
    this.physics.setTraffic(
      this.vehicles.filter((v) => v.id !== this.chassisId),
    );
    if (p.vehicleId !== undefined) {
      const v = this.vehicles.find((v) => v.id === p.vehicleId)!;
      const control = v.condition <= 0 ? { ...EMPTY_INPUT } : input;
      const feedback = this.physics.step(
        control,
        false,
        this.settings.steeringAssist,
      );
      const state = this.physics.snapshot();
      v.x = p.x = state.x;
      v.z = p.z = state.z;
      v.y = heightAt(v.x, v.z);
      p.y = state.y - 0.88;
      v.heading = p.heading = state.heading;
      v.speed = p.speed = state.speed;
      if (feedback.impact > 5) {
        const loss = clamp(feedback.impact * 0.3, 1, 17);
        v.condition = Math.max(0, v.condition - loss);
        if (this.mission) this.mission.damage += loss;
        this.event("collision", "Collision", undefined, undefined, loss);
        if (feedback.impact > 12) this.reportCrime("Dangerous collision", 8);
      }
      if (feedback.reset) {
        this.physics.reset(
          ROAD_X.reduce((a, b) =>
            Math.abs(a - p.x) < Math.abs(b - p.x) ? a : b,
          ),
          clamp(p.z, -390, 390),
        );
        this.event("info", "Vehicle recovered to a safe road.");
      }
      this.charCollider.setEnabled(false);
    } else {
      this.charCollider.setEnabled(true);
      p.aiming = input.aim;
      p.crouching = input.crouch;
      const sprint =
        input.sprint && !input.aim && !input.crouch && p.stamina > 0.1;
      let speed = input.crouch ? 1.8 : sprint ? 6.2 : 4.4;
      const moving = Math.hypot(input.moveX, input.moveZ);
      p.stamina = clamp(
        p.stamina + (sprint && moving > 0.1 ? -dt : dt * 1.6),
        0,
        8,
      );
      let dx = input.moveX * speed * dt,
        dz = input.moveZ * speed * dt;
      if (moving > 1) {
        dx /= moving;
        dz /= moving;
      }
      if (moving > 0.05) p.heading = Math.atan2(dx, dz);
      if (input.aim) p.heading = input.aimYaw;
      if (input.jump && !this.previous.jump && p.grounded) {
        p.vertical = 6.2;
        p.grounded = false;
      }
      p.vertical -= 22 * dt;
      this.controller.computeColliderMovement(this.charCollider, {
        x: dx,
        y: p.vertical * dt,
        z: dz,
      });
      const movement = this.controller.computedMovement(),
        current = this.char.translation();
      this.char.setNextKinematicTranslation({
        x: current.x + movement.x,
        y: current.y + movement.y,
        z: current.z + movement.z,
      });
      this.physics.step({ ...EMPTY_INPUT }, false);
      const actual = this.char.translation();
      p.x = actual.x;
      p.y = actual.y - 0.87;
      p.z = actual.z;
      p.speed = Math.hypot(movement.x, movement.z) / dt;
      p.grounded = this.controller.computedGrounded();
      if (p.grounded) p.vertical = 0;
      if (p.y < heightAt(p.x, p.z) - 2 || !Number.isFinite(p.y))
        this.movePlayer(SAFEHOUSE.x, SAFEHOUSE.z);
      p.inside = INTERIORS.find(
        (b) => Math.abs(p.x - b.x) < b.w / 2 && Math.abs(p.z - b.z) < b.d / 2,
      )?.id;
      this.combat(input, dt);
    }
    if (p.health < 30 && this.time - this.lastHurt > 8)
      p.health = Math.min(30, p.health + dt * 3);
    this.updateEnemies(dt);
    this.updateMission(input, dt);
    this.previous = { ...input };
  }
  private movePlayer(x: number, z: number) {
    this.player.x = x;
    this.player.z = z;
    this.player.y = heightAt(x, z);
    this.player.vertical = 0;
    this.char.setTranslation({ x, y: this.player.y + 0.87, z }, true);
    this.char.setNextKinematicTranslation({ x, y: this.player.y + 0.87, z });
  }
  private updateTraffic(dt: number) {
    const patrol = this.vehicles[7];
    if (patrol.id !== this.player.vehicleId && !patrol.stolen) {
      if (this.alert.tier > 0) {
        patrol.parked = false;
        patrol.driver = "police";
      } else if (patrol.driver === "police") {
        patrol.parked = true;
        patrol.speed = 0;
      }
    }
    for (const v of this.vehicles) {
      if (v.parked || v.id === this.player.vehicleId) continue;
      if (v.driver === "police") {
        const destination = this.alert.lastKnown,
          d = distance(v, destination),
          route = findRoute(v, destination),
          target = lineClear(v, destination)
            ? destination
            : (route.find((p, i) => i > 0 && distance(v, p) > 10) ??
              destination),
          angle = Math.atan2(target.x - v.x, target.z - v.z);
        v.heading +=
          Math.atan2(Math.sin(angle - v.heading), Math.cos(angle - v.heading)) *
          Math.min(1, dt * 1.5);
        const targetSpeed = d < 12 ? 0 : Math.min(19, 7 + d * 0.06);
        v.speed += (targetSpeed - v.speed) * dt * 1.7;
        const nx = v.x + Math.sin(v.heading) * v.speed * dt,
          nz = v.z + Math.cos(v.heading) * v.speed * dt;
        if (!blocked(nx, nz, 1.3)) {
          v.x = nx;
          v.z = nz;
        } else v.speed *= 0.8;
        v.y = heightAt(v.x, v.z);
        continue;
      }
      const target = 10 + (v.id % 4) * 1.5;
      const ahead = {
        x: v.x + Math.sin(v.heading) * 12,
        z: v.z + Math.cos(v.heading) * 12,
      };
      const obstacle =
        this.vehicles.some((o) => o.id !== v.id && distance(o, ahead) < 4) ||
        (distance(this.player, ahead) < 5 &&
          this.player.vehicleId === undefined);
      const nearCross = ROAD_Z.some((z) => Math.abs(v.z - z) < 16);
      const red = nearCross && this.time % 14 > 7;
      v.speed += (obstacle || red ? 0 : target - v.speed) * dt * 2;
      if (obstacle || red) v.speed = Math.max(0, v.speed - dt * 18);
      v.state = obstacle || red ? "brake" : "cruise";
      v.x += Math.sin(v.heading) * v.speed * dt;
      v.z += Math.cos(v.heading) * v.speed * dt;
      v.y = heightAt(v.x, v.z);
      if (v.z > 400 || v.z < -400) {
        v.heading += Math.PI;
        v.x += Math.cos(v.heading) * 8;
        v.z = clamp(v.z, -399, 399);
      }
      if (blocked(v.x, v.z, 1)) {
        v.speed = 0;
        v.heading += Math.PI;
        v.x =
          ROAD_X.reduce((a, b) =>
            Math.abs(a - v.x) < Math.abs(b - v.x) ? a : b,
          ) +
          Math.cos(v.heading) * 4;
      }
    }
  }
  private updatePeople(dt: number) {
    for (const npc of this.pedestrians) {
      const threat =
        distance(npc, this.player) < 26 &&
        (!this.player.holstered ||
          this.alert.tier > 1 ||
          this.player.speed > 12);
      if (threat) {
        npc.state = npc.id % 4 === 0 ? "report" : "flee";
        npc.goal = {
          x: npc.x + (npc.x - this.player.x) * 2,
          z: npc.z + (npc.z - this.player.z) * 2,
        };
      }
      if (npc.state === "talk" || npc.state === "work") {
        if (
          this.time % 18 < dt &&
          npc.state === "talk" &&
          distance(npc, this.player) < 8
        )
          this.event(
            "info",
            "Resident: They charge for the harbor view now. The gulls still get it free.",
          );
        continue;
      }
      if (npc.state === "report") {
        npc.report += dt;
        if (npc.report > 4) npc.state = "flee";
      }
      const dx = npc.goal.x - npc.x,
        dz = npc.goal.z - npc.z,
        d = Math.hypot(dx, dz),
        speed = npc.state === "flee" ? 3.8 : 1.25;
      if (d > 1) {
        const x = npc.x + (dx / d) * speed * dt,
          z = npc.z + (dz / d) * speed * dt;
        if (!blocked(x, z, 0.4)) {
          npc.x = x;
          npc.z = z;
          npc.heading = Math.atan2(dx, dz);
        } else npc.goal = { x: npc.home.x, z: npc.home.z };
      } else {
        npc.goal = {
          x: npc.home.x,
          z: npc.home.z + (npc.goal.z > npc.home.z ? -65 : 65),
        };
        npc.state = "walk";
      }
      npc.y = heightAt(npc.x, npc.z);
      npc.phase += dt * speed;
    }
  }
  reportCrime(type: string, severity: number, location: Vec2 = this.player) {
    if (this.time - this.lastCrime < 0.8) return;
    this.lastCrime = this.time;
    const witness = this.pedestrians.find(
      (n) => distance(n, location) < 55 && lineClear(n, location),
    );
    const police = this.enemies.find(
      (e) =>
        e.role === "police" &&
        distance(e, location) < 85 &&
        lineClear(e, location),
    );
    const camera = CONTACTS.find(
      (c) =>
        ["police", "interior"].includes(c.kind) &&
        distance(c, location) < 40 &&
        lineClear(c, location),
    );
    if (!witness && !police && !camera) {
      this.event("info", "No witness identified you.");
      return;
    }
    const crime: Crime = {
      id: ++this.counter,
      type,
      severity,
      time: this.time,
      location: { x: location.x, z: location.z },
      reported: !!police || !!camera,
      delay: police || camera ? 0 : 3 + (witness!.id % 3),
      witness: police ? -2 : camera ? -3 : witness!.id,
    };
    this.crimes.push(crime);
    if (witness) {
      witness.state = "report";
      witness.report = 0;
    }
    this.alert.state = crime.reported ? "Identified" : "Witness reporting";
    this.alert.crime = type;
    if (crime.reported) this.applyEvidence(crime);
    this.event(
      "crime",
      crime.reported ? type + " reported." : "Witness reporting: " + type,
    );
  }
  private applyEvidence(c: Crime) {
    this.alert.heat = Math.min(85, this.alert.heat + c.severity);
    this.alert.tier = clamp(Math.ceil(this.alert.heat / 18), 1, 5);
    this.alert.lastKnown = { ...c.location };
    this.alert.unseen = 0;
    this.alert.identifiedVehicle = this.player.vehicleId;
    this.alert.state = "Identified";
  }
  private updatePolice(dt: number) {
    for (const crime of this.crimes)
      if (!crime.reported && this.time - crime.time >= crime.delay) {
        crime.reported = true;
        this.applyEvidence(crime);
      }
    const patrol = this.vehicles[7];
    const patrolSees =
      patrol.driver === "police" &&
      distance(patrol, this.player) < 90 &&
      lineClear(patrol, this.player);
    const visible =
      this.time > this.smokeUntil &&
      (patrolSees ||
        this.enemies.some(
          (e) =>
            e.role === "police" &&
            e.hp > 0 &&
            distance(e, this.player) < (this.player.crouching ? 32 : 75) &&
            lineClear(e, this.player),
        ));
    if (this.alert.tier === 0) return;
    if (visible) {
      this.alert.unseen = 0;
      this.alert.lastKnown = { x: this.player.x, z: this.player.z };
      this.alert.state = "Pursuit";
    } else {
      this.alert.unseen += dt;
      this.alert.state =
        this.alert.unseen < 3
          ? "Identified"
          : this.alert.unseen < 10
            ? "Search"
            : "Cooling";
      if (this.alert.unseen > 14 + this.alert.tier * 4) {
        this.alert.heat = Math.max(0, this.alert.heat - dt * 3);
        this.alert.tier = Math.ceil(this.alert.heat / 18);
        if (!this.alert.tier) {
          this.alert.state = "Unnoticed";
          this.event("info", "Alert cleared. You are unidentified.");
          this.enemies.splice(
            0,
            this.enemies.length,
            ...this.enemies.filter((e) => e.role !== "police"),
          );
        }
      }
    }
    const police = this.enemies.filter((e) => e.role === "police" && e.hp > 0);
    if (
      this.time - this.lastPolice > 6 &&
      police.length < Math.min(8, this.alert.tier * 2)
    ) {
      this.lastPolice = this.time;
      const angle = this.player.heading + Math.PI + this.random(),
        x = clamp(this.player.x + Math.sin(angle) * 100, -405, 405),
        z = clamp(this.player.z + Math.cos(angle) * 100, -405, 405);
      this.spawnEnemy(
        "police",
        ROAD_X.reduce((a, b) => (Math.abs(a - x) < Math.abs(b - x) ? a : b)) +
          14,
        z,
      );
    }
    if (
      visible &&
      this.player.holstered &&
      this.player.speed < 0.3 &&
      this.alert.tier < 3 &&
      police.some((e) => distance(e, this.player) < 2)
    ) {
      this.player.cash = Math.max(0, this.player.cash - 100);
      this.player.health = Math.max(60, this.player.health);
      this.clearAlert();
      this.exitVehicle();
      this.movePlayer(360, 90);
      this.event("info", "You complied. A $100 civic fine has been paid.");
    }
  }
  clearAlert() {
    // A retry or paid compliance resolves this incident, including delayed reports.
    this.crimes.length = 0;
    this.lastCrime = -Infinity;
    this.alert.heat = 0;
    this.alert.tier = 0;
    this.alert.unseen = 0;
    this.alert.state = "Unnoticed";
    this.enemies.splice(
      0,
      this.enemies.length,
      ...this.enemies.filter((e) => e.role !== "police"),
    );
  }
  private spawnEnemy(role: Enemy["role"], x: number, z: number) {
    this.enemies.push({
      id: ++this.counter,
      x,
      y: heightAt(x, z),
      z,
      heading: 0,
      hp: 100,
      role,
      state: role === "police" ? "investigate" : "patrol",
      cooldown: 1 + this.random(),
      home: { x, z },
      alerted: role === "police",
      stun: 0,
    });
  }
  private updateEnemies(dt: number) {
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      if (e.stun > 0) {
        e.stun -= dt;
        e.state = "stunned";
        continue;
      }
      const d = distance(e, this.player),
        visible =
          d < 60 && lineClear(e, this.player) && this.time > this.smokeUntil;
      if (visible && (!this.player.holstered || d < 19 || e.role === "police"))
        e.alerted = true;
      if (visible && e.alerted) {
        e.lastSeen = { x: this.player.x, z: this.player.z };
        e.seenAt = this.time;
      }
      if (!visible && e.role !== "police" && this.time - (e.seenAt ?? 0) > 18) {
        e.alerted = false;
        e.state = "search";
      }
      const target = visible
        ? this.player
        : e.role === "police"
          ? this.alert.lastKnown
          : (e.lastSeen ?? e.home);
      if (e.alerted) {
        e.heading = Math.atan2(target.x - e.x, target.z - e.z);
        e.state = visible && d < 20 ? "attack" : "chase";
        const complying =
          e.role === "police" && this.alert.tier < 3 && this.player.holstered;
        if (distance(e, target) > (complying ? 1.6 : 12) || !visible) {
          const route = findRoute(e, target);
          const next = lineClear(e, target)
            ? target
            : (route.find((p, i) => i > 0 && distance(e, p) > 3) ?? target);
          const h = Math.atan2(next.x - e.x, next.z - e.z),
            x = e.x + Math.sin(h) * 3.5 * dt,
            z = e.z + Math.cos(h) * 3.5 * dt;
          if (!blocked(x, z, 0.5)) {
            e.x = x;
            e.z = z;
          } else {
            const side = h + Math.PI / 2;
            if (!blocked(e.x + Math.sin(side), e.z + Math.cos(side), 0.5)) {
              e.x += Math.sin(side) * dt * 2;
              e.z += Math.cos(side) * dt * 2;
            }
          }
        }
        e.cooldown -= dt;
        if (visible && d < 45 && e.cooldown <= 0 && !complying) {
          e.cooldown = e.role === "police" ? 1.4 : 1.1;
          this.event(
            "shot",
            "Hostile fire",
            { x: e.x, y: e.y + 1.3, z: e.z },
            { x: this.player.x, y: this.player.y + 1, z: this.player.z },
          );
          if (d < 18 || this.random() < 0.36)
            this.hurt(e.role === "police" ? 6 : 9);
        }
      }
      e.y = heightAt(e.x, e.z);
    }
  }
  private hurt(amount: number) {
    const armor = Math.min(this.player.armor, amount * 0.6);
    this.player.armor -= armor;
    this.player.health = Math.max(0, this.player.health - (amount - armor));
    this.lastHurt = this.time;
    if (this.mission) this.mission.damage += amount;
    if (!this.player.health) {
      this.player.dead = true;
      if (this.mission)
        this.mission.fail =
          "You were incapacitated. Restart the mission or return to the courier office.";
      this.event("death", "Incapacitated");
    }
  }
  private combat(input: InputFrame, dt: number) {
    const p = this.player,
      w = WEAPONS[p.weapon];
    this.shotCooldown -= dt;
    if (p.reload > 0) {
      p.reload -= dt;
      if (p.reload <= 0) {
        const n = Math.min(w.mag - p.ammo, p.reserve);
        p.ammo += n;
        p.reserve -= n;
        this.event("pickup", "Reloaded");
      }
      return;
    }
    if (
      input.reload &&
      !this.previous.reload &&
      p.ammo < w.mag &&
      p.reserve > 0
    )
      p.reload = w.reload;
    if (input.melee && !this.previous.melee) {
      const e = this.enemies.find((e) => e.hp > 0 && distance(e, p) < 2.8);
      if (e) {
        e.hp = Math.max(0, e.hp - 60);
        e.stun = 4;
        this.event("hit", "Baton strike");
      }
      return;
    }
    if (!input.fire || this.shotCooldown > 0 || p.holstered) return;
    if (p.ammo <= 0 && p.weapon !== "baton") {
      this.event("info", "Magazine empty. Press R to reload.");
      this.shotCooldown = 0.4;
      return;
    }
    this.shotCooldown = w.rate;
    if (p.weapon !== "baton") p.ammo--;
    const direction = {
        x: Math.sin(input.aimYaw) * Math.cos(input.aimPitch),
        y: Math.sin(input.aimPitch),
        z: Math.cos(input.aimYaw) * Math.cos(input.aimPitch),
      },
      origin = { x: p.x, y: p.y + 1.45, z: p.z };
    let target: Enemy | undefined,
      best = w.range;
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const dx = e.x - origin.x,
        dy = e.y + 1.1 - origin.y,
        dz = e.z - origin.z,
        along = dx * direction.x + dy * direction.y + dz * direction.z,
        off = Math.sqrt(
          Math.max(0, dx * dx + dy * dy + dz * dz - along * along),
        );
      if (
        along > 0 &&
        along < best &&
        off < (input.aim ? 0.8 : 1.05) &&
        lineClear(p, e)
      ) {
        target = e;
        best = along;
      }
    }
    const end = {
      x: origin.x + direction.x * best,
      y: origin.y + direction.y * best,
      z: origin.z + direction.z * best,
    };
    this.event("shot", w.name, origin, end);
    if (target) {
      const head = end.y - target.y > 1.45,
        damage = w.damage * (head ? 1.5 : 1);
      target.hp = Math.max(0, target.hp - damage);
      target.alerted = true;
      if (w.nonlethal) target.stun = target.hp <= 0 ? 999 : 3;
      this.event(
        "hit",
        target.hp <= 0
          ? w.nonlethal
            ? "Threat subdued"
            : "Threat neutralized"
          : "Hit",
        end,
        undefined,
        damage,
      );
      if (target.role === "police")
        this.reportCrime("Attack on Civic Safety", 30);
    }
    if (!w.nonlethal) this.reportCrime("Weapon discharge", 12);
  }
  setWeapon(id: WeaponId) {
    if (id === this.player.weapon) {
      this.player.holstered = false;
      return;
    }
    this.player.weapon = id;
    this.player.ammo = 0;
    this.player.reload = 0;
    this.player.holstered = false;
  }
  toggleHolster() {
    this.player.holstered = !this.player.holstered;
    if (!this.player.holstered)
      this.event("info", "Weapon ready. Right mouse aims; left mouse fires.");
  }
  interact() {
    if (this.player.vehicleId !== undefined) return;
    const stage = this.currentStage();
    if (
      stage &&
      distance(this.player, stage.target) < stage.radius &&
      ["interact", "investigate"].includes(stage.type)
    ) {
      this.interactions++;
      return;
    }
    const vehicle = this.vehicles
      .filter((v) => Math.abs(v.speed) < 4 && distance(v, this.player) < 5)
      .sort((a, b) => distance(a, this.player) - distance(b, this.player))[0];
    if (vehicle) {
      this.enterVehicle(vehicle.id);
      return;
    }
    const contact = CONTACTS.find((c) => distance(c, this.player) < 12);
    if (contact) {
      this.event("info", contact.line);
      if (contact.kind === "garage") this.buy("repair");
      if (contact.kind === "clothing") {
        if (this.alert.unseen > 5) {
          this.alert.heat = Math.max(0, this.alert.heat - 24);
          this.alert.tier = Math.ceil(this.alert.heat / 18);
          this.event("info", "Changed your jacket. Identification reduced.");
        } else
          this.event(
            "info",
            "Break police sight before changing your appearance.",
          );
      }
    }
  }
  enterVehicle(id: number) {
    if (this.player.vehicleId !== undefined) return false;
    const v = this.vehicles.find((v) => v.id === id);
    if (!v || distance(v, this.player) > 6 || Math.abs(v.speed) > 4) {
      this.event("info", "Get closer to a stopped vehicle.");
      return false;
    }
    if (v.locked) {
      this.event("info", "This Civic Safety vehicle is locked.");
      return false;
    }
    if (!v.owned && !v.stolen) {
      v.stolen = true;
      this.reportCrime("Vehicle taken", 10);
    }
    this.physics.dispose();
    this.physics = new ArcadeVehicle(
      VEHICLES.find((d) => d.id === v.definition)!,
      v.x,
      v.z,
      v.heading,
    );
    this.chassisId = v.id;
    this.char = this.physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
        v.x,
        v.y + 0.87,
        v.z,
      ),
    );
    this.charCollider = this.physics.world.createCollider(
      RAPIER.ColliderDesc.capsule(0.5, 0.33),
      this.char,
    );
    this.charCollider.setEnabled(false);
    this.controller = this.makeController();
    this.player.vehicleId = v.id;
    this.player.inside = undefined;
    v.parked = true;
    v.driver = "none";
    this.player.holstered = true;
    this.event(
      "info",
      "Driving " +
        VEHICLES.find((d) => d.id === v.definition)!.name +
        ". F to exit.",
    );
    return true;
  }
  exitVehicle() {
    if (this.player.vehicleId === undefined) return false;
    const v = this.vehicles.find((v) => v.id === this.player.vehicleId)!;
    if (Math.abs(v.speed) > 5) {
      this.event("info", "Slow below 18 km/h before exiting.");
      return false;
    }
    v.speed = 0;
    v.parked = true;
    this.physics.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.player.vehicleId = undefined;
    const side =
      [-1, 1].find(
        (s) =>
          !blocked(
            v.x + Math.cos(v.heading) * s * 2.5,
            v.z - Math.sin(v.heading) * s * 2.5,
            0.5,
          ),
      ) ?? -1;
    this.movePlayer(
      v.x + Math.cos(v.heading) * side * 2.5,
      v.z - Math.sin(v.heading) * side * 2.5,
    );
    this.charCollider.setEnabled(true);
    this.event("info", "On foot. E to interact.");
    return true;
  }
  buy(item: "ammo" | "medkit" | "armor" | "repair" | WeaponId) {
    const contact = CONTACTS.find(
      (c) => c.kind === (item === "repair" ? "garage" : "shop"),
    );
    if (!contact || distance(contact, this.player) > 22) {
      this.event(
        "info",
        item === "repair"
          ? "Visit Mara’s garage to repair a vehicle."
          : "Visit Night Shift Supplies to purchase equipment.",
      );
      return false;
    }
    const prices: Record<string, number> = {
      ammo: 60,
      medkit: 45,
      armor: 110,
      repair: 90,
    };
    const cost = prices[item] ?? WEAPONS[item as WeaponId]?.price ?? 0;
    if (this.player.cash < cost) {
      this.event("info", "Not enough cash.");
      return false;
    }
    this.player.cash -= cost;
    if (item === "ammo") this.player.reserve += 72;
    else if (item === "medkit")
      this.player.medkits = Math.min(5, this.player.medkits + 1);
    else if (item === "armor") this.player.armor = 50;
    else if (item === "repair") {
      const v =
        this.vehicles.find((v) => v.id === this.player.vehicleId) ??
        this.vehicles.filter((v) => distance(v, this.player) < 20)[0];
      if (!v) {
        this.player.cash += cost;
        this.event("info", "Bring a vehicle to the garage.");
        return false;
      }
      v.condition = 100;
      this.physics.damage = 0;
    } else this.setWeapon(item);
    this.event("pickup", "Purchase complete.");
    return true;
  }
  startMission(id: string, replay = false) {
    const def = MISSIONS.find((m) => m.id === id);
    if (!def) return false;
    const index = MISSIONS.indexOf(def);
    if (
      def.kind === "story" &&
      index > 0 &&
      !this.completed.includes(MISSIONS[index - 1].id) &&
      !this.completed.includes(id)
    ) {
      this.event("info", "Finish the previous story mission first.");
      return false;
    }
    this.result = undefined;
    this.mission = {
      id,
      stage: 0,
      elapsed: 0,
      progress: 0,
      checkpoint: 0,
      replay: replay || this.completed.includes(id),
      damage: 0,
      civilianHarm: 0,
      started: this.time,
    };
    this.interactions = 0;
    this.nextWave = 0;
    const resetVehicle = (
      vehicleId: number,
      x: number,
      z: number,
      heading: number,
    ) => {
      const v = this.vehicles[vehicleId];
      if (this.player.vehicleId === vehicleId) return;
      Object.assign(v, {
        x,
        z,
        y: heightAt(x, z),
        heading,
        speed: 0,
        condition: 100,
        parked: true,
        driver: "none",
      });
      if (this.chassisId === vehicleId) this.physics.reset(x, z, heading);
    };
    if (id === "first-shift") resetVehicle(0, -174, -298, 0);
    if (id === "hot-cargo") resetVehicle(2, 184, 84, Math.PI);
    if (id === "recovery") resetVehicle(3, 370, -310, Math.PI / 2);
    this.enemies.splice(
      0,
      this.enemies.length,
      ...this.enemies.filter((e) => e.role === "police"),
    );
    if (id === "lost-manifest") {
      this.spawnEnemy("security", -296, -153);
      this.spawnEnemy("security", -271, -146);
    }
    if (id === "hot-cargo") {
      this.spawnEnemy("rival", 174, 91);
      this.spawnEnemy("rival", 196, 85);
    }
    this.event("mission", def.name);
    return true;
  }
  abandon() {
    this.mission = undefined;
    this.result = undefined;
    this.enemies.splice(
      0,
      this.enemies.length,
      ...this.enemies.filter((e) => e.role === "police"),
    );
    this.event("info", "Mission abandoned. South Quay is yours.");
  }
  private currentStage() {
    const def = MISSIONS.find((d) => d.id === this.mission?.id);
    return def?.stages[this.mission?.stage ?? 0];
  }
  private updateMission(input: InputFrame, dt: number) {
    const m = this.mission,
      stage = this.currentStage();
    if (!m || !stage || m.fail || this.result) return;
    m.elapsed += dt;
    const near = distance(this.player, stage.target) < stage.radius;
    let complete = false;
    if (stage.type === "enter")
      complete =
        this.player.vehicleId !== undefined &&
        (m.id === "hot-cargo"
          ? this.vehicles[this.player.vehicleId].definition === "parcel"
          : m.id === "recovery"
            ? this.vehicles[this.player.vehicleId].definition === "skiff"
            : true);
    if (stage.type === "drive" || stage.type === "circuit")
      complete =
        near &&
        (!stage.requiresVehicle || this.player.vehicleId !== undefined) &&
        (stage.type === "circuit" ||
          (!stage.requiresVehicle && this.player.vehicleId === undefined) ||
          this.player.speed < 3);
    if (stage.type === "interact")
      complete =
        near && this.player.vehicleId === undefined && this.interactions > 0;
    if (stage.type === "investigate") {
      if (near && this.player.vehicleId === undefined && input.interact)
        m.progress += dt;
      complete = m.progress >= (stage.duration ?? 4);
    }
    if (stage.type === "combat")
      complete = this.enemies
        .filter((e) => e.role === "rival")
        .every((e) => e.hp <= 0);
    if (stage.type === "survive") {
      m.progress += dt;
      if (
        m.progress >= this.nextWave &&
        this.enemies.filter((e) => e.role === "rival" && e.hp > 0).length < 3
      ) {
        this.spawnEnemy("rival", this.player.x + 26, this.player.z - 20);
        this.spawnEnemy("rival", this.player.x - 25, this.player.z + 18);
        this.nextWave = m.progress + 12;
      }
      complete = m.progress >= (stage.duration ?? 35);
    }
    if (stage.type === "escape") {
      if (this.alert.tier === 0) m.progress += dt;
      complete = m.progress > 2;
    }
    if (m.id === "hot-cargo" && this.vehicles[2].condition <= 0)
      m.fail =
        "The cargo van is too badly damaged. Restart the recovery mission.";
    if (complete) {
      m.stage++;
      m.progress = 0;
      this.nextWave = 0;
      this.interactions = 0;
      m.checkpoint = m.stage;
      if (m.id === "signal-breakwater" && m.stage === 3) {
        this.alert.heat = 54;
        this.alert.tier = 3;
        this.alert.state = "Identified";
        this.alert.lastKnown = { x: this.player.x, z: this.player.z };
        this.alert.unseen = 0;
      }
      const next = this.currentStage();
      if (next) this.event("mission", next.text);
      else this.completeMission();
    }
  }
  private completeMission() {
    const m = this.mission!,
      def = MISSIONS.find((d) => d.id === m.id)!;
    const reward = m.replay
      ? 0
      : Math.round(def.reward * (m.damage > 70 ? 0.7 : 1));
    const grade =
      m.damage < 10 ? "S" : m.damage < 35 ? "A" : m.damage < 80 ? "B" : "C";
    const result: MissionResult = {
      id: def.id,
      name: def.name,
      grade,
      reward,
      trust: m.replay ? 0 : def.trust,
      duration: m.elapsed,
      damage: m.damage,
      replay: m.replay,
      date: Date.now(),
    };
    this.result = result;
    this.results.push(result);
    this.player.cash += reward;
    this.player.trust = clamp(this.player.trust + result.trust, 0, 5);
    if (!this.completed.includes(m.id) && def.kind === "story")
      this.completed.push(m.id);
    this.event("reward", def.name + " complete", undefined, undefined, reward);
  }
  dismissResult() {
    this.result = undefined;
    this.mission = undefined;
  }
  retry() {
    const id = this.mission?.id;
    const replay = this.mission?.replay;
    this.player.dead = false;
    this.player.health = 100;
    this.player.armor = 30;
    this.player.ammo = WEAPONS[this.player.weapon].mag;
    this.player.vehicleId = undefined;
    this.vehicles[2].condition = 100;
    this.physics.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.clearAlert();
    this.movePlayer(SAFEHOUSE.x, SAFEHOUSE.z);
    if (id) this.startMission(id, replay);
  }
  snapshot(): Snapshot {
    const def = MISSIONS.find((d) => d.id === this.mission?.id),
      stage = this.currentStage();
    let interaction: Snapshot["interaction"];
    if (this.player.vehicleId === undefined) {
      if (
        stage &&
        distance(this.player, stage.target) < stage.radius &&
        ["interact", "investigate"].includes(stage.type)
      )
        interaction = {
          label:
            stage.type === "investigate"
              ? "Hold E — " + stage.label
              : "E — " + stage.label,
          kind: "mission",
          id: this.mission!.id,
        };
      else {
        const v = this.vehicles.find(
          (v) => distance(v, this.player) < 5 && Math.abs(v.speed) < 4,
        );
        if (v)
          interaction = {
            label: v.locked
              ? "Vehicle locked"
              : `E — ${v.owned ? "Ride" : "Take"} ${VEHICLES.find((d) => d.id === v.definition)!.name}${v.owned ? "" : " · witnesses may report"}`,
            kind: "vehicle",
            id: String(v.id),
          };
        else {
          const c = CONTACTS.find((c) => distance(c, this.player) < 11);
          if (c)
            interaction = {
              label: "E — " + c.name,
              kind:
                c.kind === "shop"
                  ? "shop"
                  : c.kind === "safehouse"
                    ? "save"
                    : "contact",
              id: c.id,
            };
        }
      }
    }
    if (stage && this.time > this.routeAt) {
      this.route = findRoute(this.player, stage.target);
      this.routeAt = this.time + 1;
    }
    return {
      time: this.time,
      player: { ...this.player },
      vehicle:
        this.player.vehicleId === undefined
          ? undefined
          : this.physics.snapshot(),
      vehicles: this.vehicles.map((v) => ({ ...v })),
      pedestrians: this.pedestrians.map((n) => ({ ...n })),
      enemies: this.enemies.map((e) => ({ ...e })),
      mission: this.mission ? { ...this.mission } : undefined,
      missionDefinition: def,
      completed: [...this.completed],
      alert: { ...this.alert },
      events: [...this.events],
      result: this.result,
      target: stage?.target,
      route: this.route,
      interaction,
      day: (this.time % 2700) / 2700,
      district: districtAt(this.player.x, this.player.z),
      fps: 60,
    };
  }
  save(): SaveGame {
    const v = this.vehicles.find((v) => v.id === this.player.vehicleId);
    const safe =
      distance(this.player, SAFEHOUSE) < 35 && !this.player.dead
        ? {
            x: this.player.x,
            y: heightAt(this.player.x, this.player.z),
            z: this.player.z,
          }
        : {
            x: SAFEHOUSE.x,
            y: heightAt(SAFEHOUSE.x, SAFEHOUSE.z),
            z: SAFEHOUSE.z,
          };
    return {
      version: 1,
      player: {
        ...this.player,
        ...safe,
        vehicleId: undefined,
        health: Math.max(35, this.player.health),
        dead: false,
        vertical: 0,
      },
      completed: [...this.completed],
      time: this.time,
      results: [...this.results],
      mission:
        this.mission && !this.result
          ? { ...this.mission, progress: 0 }
          : undefined,
      vehicle: v
        ? {
            definition: v.definition,
            condition: v.condition,
            x: v.x,
            z: v.z,
            heading: v.heading,
            owned: v.owned,
            stolen: v.stolen,
          }
        : undefined,
      checkpoint: safe,
      alert: this.alert.tier
        ? { ...this.alert, lastKnown: { ...this.alert.lastKnown } }
        : undefined,
      date: Date.now(),
    };
  }
  configure(settings: Settings) {
    this.settings = settings;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.physics.dispose();
  }
}
