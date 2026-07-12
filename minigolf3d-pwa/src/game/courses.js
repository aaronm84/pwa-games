import pinewood from './courses/pinewood.js'
import cove from './courses/cove.js'
import area51 from './courses/area51.js'

export { PLAY_W, PLAY_H } from './courseKit.js'

export const courses = [pinewood, cove, area51]

export function courseById(id) {
  return courses.find((c) => c.id === id) || courses[0]
}

export function coursePar(course) {
  return course.holes.reduce((sum, h) => sum + h.par, 0)
}
