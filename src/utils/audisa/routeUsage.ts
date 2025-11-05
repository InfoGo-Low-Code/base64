let routeUsage = false
let user = ''

export function setRouteUsageAudisa(usage: boolean) {
  routeUsage = usage
}

export function getRouteUsageAudisa(): boolean {
  return routeUsage
}

export function setUserUsage(userUsage: string) {
  user = userUsage
}

export function getUserUsage(): string {
  return user
}
