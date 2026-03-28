export type HealthStatus = {
  service: string
  timestamp: string
}

export interface HealthService {
  getStatus(): HealthStatus
}

type SystemClock = {
  now(): Date
}

type HealthServiceDependencies = {
  clock?: SystemClock
  serviceName: string
}

export class DefaultHealthService implements HealthService {
  private readonly clock: SystemClock
  private readonly serviceName: string

  constructor({
    clock = { now: () => new Date() },
    serviceName,
  }: HealthServiceDependencies) {
    this.clock = clock
    this.serviceName = serviceName
  }

  getStatus(): HealthStatus {
    return {
      service: this.serviceName,
      timestamp: this.clock.now().toISOString(),
    }
  }
}
