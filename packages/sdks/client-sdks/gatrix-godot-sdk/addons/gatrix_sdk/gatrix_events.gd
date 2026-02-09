# Gatrix SDK Event Constants
# All events use the 'flags.' prefix for namespacing
class_name GatrixEvents

const FLAGS_INIT := "flags.init"
const FLAGS_READY := "flags.ready"
const FLAGS_FETCH := "flags.fetch"
const FLAGS_FETCH_START := "flags.fetch_start"
const FLAGS_FETCH_SUCCESS := "flags.fetch_success"
const FLAGS_FETCH_ERROR := "flags.fetch_error"
const FLAGS_FETCH_END := "flags.fetch_end"
const FLAGS_CHANGE := "flags.change"
const SDK_ERROR := "flags.error"
const FLAGS_RECOVERED := "flags.recovered"
const FLAGS_SYNC := "flags.sync"
const FLAGS_IMPRESSION := "flags.impression"
const FLAGS_METRICS_SENT := "flags.metrics.sent"


# Build per-flag change event name
static func flag_change_event(flag_name: String) -> String:
	return "flags.%s.change" % flag_name
