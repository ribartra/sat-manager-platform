import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { assertApprovedSession } from "@/lib/rbac";
import { checkRateLimit } from "@/lib/rate-limit";
import { BadRequestError, RateLimitError, withApiErrors } from "@/lib/api-error";
import { ISSUE_CATEGORIES, ISSUE_COMMENT_MAX, ISSUE_SCREENSHOT_MAX, ISSUE_TARGET_MAX, type IssueTarget } from "@/lib/issue-report";
import { emailIssueReport } from "@/lib/issue-report-server";

const CATEGORIES = new Set<string>(ISSUE_CATEGORIES.map((c) => c.value));
const KINDS = new Set(["element", "area", "page"]);

function field(form: FormData, name: string, max: number) {
  const value = form.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function screenshotType(buffer: Buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  return null;
}

// POST /api/issue-reports — "Report a problem" (components/sat/issue-reporter.tsx), any signed-in user.
// Saved first, then emailed to ISSUE_REPORT_EMAIL; a failed email never loses the report.
export const POST = withApiErrors(async function POST(req: NextRequest) {
  const session = await assertApprovedSession();
  const limit = checkRateLimit(`issue-report:${session.user.id}`, 10, 60 * 60 * 1000);
  if (!limit.allowed) throw new RateLimitError((limit.resetAt - Date.now()) / 1000, "You sent many reports in a short time. Try again later.");

  const form = await req.formData();
  const comment = field(form, "comment", ISSUE_COMMENT_MAX + 1);
  const category = field(form, "category", 20);
  const url = field(form, "url", 2000);
  const rawTarget = field(form, "target", ISSUE_TARGET_MAX + 1);
  if (!comment) throw new BadRequestError("Write what you see before sending.");
  if (comment.length > ISSUE_COMMENT_MAX) throw new BadRequestError(`Keep the comment under ${ISSUE_COMMENT_MAX} characters.`);
  if (!CATEGORIES.has(category)) throw new BadRequestError("Choose a category.");
  if (rawTarget.length > ISSUE_TARGET_MAX) throw new BadRequestError("The selection is too large. Select a smaller area.");
  let target: IssueTarget;
  try {
    target = JSON.parse(rawTarget) as IssueTarget;
  } catch {
    throw new BadRequestError("Invalid selection.");
  }
  if (!target || typeof target !== "object" || !KINDS.has(target.kind)) throw new BadRequestError("Invalid selection.");
  let pageUrl: URL;
  try {
    pageUrl = new URL(url);
  } catch {
    throw new BadRequestError("Invalid page address.");
  }
  // Only pages of this app (the link goes into the email).
  const hosts = [req.nextUrl.host, req.headers.get("host"), req.headers.get("x-forwarded-host"), process.env.AUTH_URL ? new URL(process.env.AUTH_URL).host : null];
  if (!hosts.includes(pageUrl.host)) throw new BadRequestError("Invalid page address.");

  let screenshot: Buffer | null = null;
  let type: string | null = null;
  const file = form.get("screenshot");
  if (file instanceof File && file.size > 0) {
    if (file.size > ISSUE_SCREENSHOT_MAX) throw new BadRequestError("The screenshot is too large.");
    screenshot = Buffer.from(await file.arrayBuffer());
    type = screenshotType(screenshot);
    if (!type) throw new BadRequestError("The screenshot must be a JPEG or PNG image.");
  }

  const report = await prisma.issueReport.create({
    data: {
      userId: session.user.id,
      role: session.user.role,
      category,
      comment,
      url: pageUrl.toString(),
      pageTitle: field(form, "pageTitle", 300) || null,
      viewport: field(form, "viewport", 40) || null,
      userAgent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
      target: JSON.stringify(target),
      screenshot: screenshot ? new Uint8Array(screenshot) : null,
      screenshotType: type,
    },
    select: { id: true },
  });
  const email = await emailIssueReport(report.id);
  return NextResponse.json({ id: report.id, emailed: email.sent }, { status: 201 });
});
