import { http, HttpResponse } from "msw"
import coalitionsMock from "./coalitions.json"

export const handlers = [
	// http.get("*/api/coalition/", () => {
	// 	return HttpResponse.json(coalitionsMock)
	// }),
]
