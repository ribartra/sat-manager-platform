import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client.js";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
import bcrypt from "bcryptjs";

const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const adapter = new PrismaBetterSqlite3({ url });

const prisma = new PrismaClient({ adapter });

async function main() {
  const adminHash = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { email: "admin@sat.com" },
    update: { active: true, validationStatus: "APPROVED" },
    create: {
      name: "SAT Admin",
      email: "admin@sat.com",
      passwordHash: adminHash,
      role: "ADMIN",
      active: true,
      validationStatus: "APPROVED",
    },
  });

  // Teacher
  const teacherHash = await bcrypt.hash("teacher123", 10);
  const teacher = await prisma.user.upsert({
    where: { email: "teacher@sat.com" },
    update: { active: true, validationStatus: "APPROVED" },
    create: {
      name: "SAT Teacher",
      email: "teacher@sat.com",
      passwordHash: teacherHash,
      role: "TEACHER",
      active: true,
      validationStatus: "APPROVED",
    },
  });

  const defaultProgram = await prisma.program.upsert({
    where: { id: "program-sat-core" },
    update: { contractEndsAt: null, active: true },
    create: {
      id: "program-sat-core",
      name: "SAT Core Program",
      contractEndsAt: null,
      active: true,
    },
  });

  await prisma.programTeacher.upsert({
    where: { programId_teacherId: { programId: defaultProgram.id, teacherId: teacher.id } },
    update: { active: true },
    create: { programId: defaultProgram.id, teacherId: teacher.id, active: true },
  });

  // Students
  const studentHash = await bcrypt.hash("student123", 10);
  const students = await Promise.all(
    ["Ana Torres", "Luis Mora", "Sofia Rea", "Carlos Vera"].map((name, i) =>
      prisma.user.upsert({
        where: { email: `student${i + 1}@sat.com` },
        update: { active: true, validationStatus: "APPROVED" },
        create: {
          name,
          email: `student${i + 1}@sat.com`,
          passwordHash: studentHash,
          role: "STUDENT",
          phone: `+51 9${i}0000000`,
          startDate: new Date("2026-04-01"),
          active: true,
          validationStatus: "APPROVED",
        },
      })
    )
  );

  await Promise.all(
    students.map((student) =>
      prisma.programEnrollment.upsert({
        where: { programId_studentId: { programId: defaultProgram.id, studentId: student.id } },
        update: { active: true },
        create: { programId: defaultProgram.id, studentId: student.id, active: true },
      })
    )
  );

  // Groups
  const groupA = await prisma.group.upsert({
    where: { id: "group-a" },
    update: {},
    create: { id: "group-a", name: "Group A", schedule: "Monday/Wednesday 9am" },
  });
  const groupB = await prisma.group.upsert({
    where: { id: "group-b" },
    update: {},
    create: { id: "group-b", name: "Group B", schedule: "Tuesday/Thursday 3pm" },
  });

  await Promise.all([
    prisma.groupMembership.upsert({
      where: { userId_groupId: { userId: students[0].id, groupId: groupA.id } },
      update: {},
      create: { userId: students[0].id, groupId: groupA.id },
    }),
    prisma.groupMembership.upsert({
      where: { userId_groupId: { userId: students[1].id, groupId: groupA.id } },
      update: {},
      create: { userId: students[1].id, groupId: groupA.id },
    }),
    prisma.groupMembership.upsert({
      where: { userId_groupId: { userId: students[2].id, groupId: groupB.id } },
      update: {},
      create: { userId: students[2].id, groupId: groupB.id },
    }),
    prisma.groupMembership.upsert({
      where: { userId_groupId: { userId: students[3].id, groupId: groupB.id } },
      update: {},
      create: { userId: students[3].id, groupId: groupB.id },
    }),
  ]);

  // Academic Taxonomy
  const mathSection = await prisma.section.upsert({
    where: { name: "MATH" },
    update: {},
    create: { name: "MATH", label: "Mathematics" },
  });
  const rwSection = await prisma.section.upsert({
    where: { name: "READING_WRITING" },
    update: {},
    create: { name: "READING_WRITING", label: "Reading & Writing" },
  });

  const mathDomains = await Promise.all([
    prisma.domain.create({ data: { name: "Algebra", sectionId: mathSection.id } }),
    prisma.domain.create({ data: { name: "Advanced Math", sectionId: mathSection.id } }),
    prisma.domain.create({ data: { name: "Problem Solving and Data Analysis", sectionId: mathSection.id } }),
    prisma.domain.create({ data: { name: "Geometry and Trigonometry", sectionId: mathSection.id } }),
  ]);

  const rwDomains = await Promise.all([
    prisma.domain.create({ data: { name: "Information and Ideas", sectionId: rwSection.id } }),
    prisma.domain.create({ data: { name: "Craft and Structure", sectionId: rwSection.id } }),
    prisma.domain.create({ data: { name: "Expression of Ideas", sectionId: rwSection.id } }),
    prisma.domain.create({ data: { name: "Standard English Conventions", sectionId: rwSection.id } }),
  ]);

  // Topics per domain
  const topicDefs: Record<string, string[]> = {
    Algebra: ["Linear Equations", "Systems of Equations", "Inequalities", "Linear Functions"],
    "Advanced Math": ["Quadratic Functions", "Polynomials", "Exponential Functions", "Radical Equations"],
    "Problem Solving and Data Analysis": ["Ratios and Proportions", "Percentages", "Statistics", "Probability"],
    "Geometry and Trigonometry": ["Circles", "Triangles", "Trigonometry", "Volume and Area"],
    "Information and Ideas": ["Central Ideas", "Textual Evidence", "Inferences", "Cross-Text Connections"],
    "Craft and Structure": ["Words in Context", "Text Structure", "Author Purpose"],
    "Expression of Ideas": ["Rhetorical Synthesis", "Transitions"],
    "Standard English Conventions": ["Boundaries", "Form, Structure, and Sense"],
  };

  const allDomains = [...mathDomains, ...rwDomains];
  const topicsByDomain: Record<string, { id: string; name: string }[]> = {};

  for (const domain of allDomains) {
    const names = topicDefs[domain.name] ?? [];
    const topics = await Promise.all(
      names.map((name) => prisma.topic.create({ data: { name, domainId: domain.id } }))
    );
    topicsByDomain[domain.id] = topics;
  }

  // Sample questions and practice sets for Algebra / Linear Equations
  const algebraDomain = mathDomains[0];
  const linearEqTopic = topicsByDomain[algebraDomain.id]?.[0];

  if (linearEqTopic) {
    const q1 = await prisma.question.create({
      data: {
        stem: "Which value of $x$ satisfies $2x + 6 = 14$?",
        type: "MC",
        difficulty: "EASY",
        correctAnswer: "C",
        explanation: "Subtract 6 from both sides: $2x = 8$. Divide by 2: $x = 4$.",
        topicId: linearEqTopic.id,
        status: "PUBLISHED",
        options: {
          create: [
            { label: "A", text: "$x = 2$" },
            { label: "B", text: "$x = 3$" },
            { label: "C", text: "$x = 4$" },
            { label: "D", text: "$x = 5$" },
          ],
        },
      },
    });

    const q2 = await prisma.question.create({
      data: {
        stem: "If $3x - 9 = 0$, what is the value of $x$?",
        type: "NUMERIC",
        difficulty: "EASY",
        correctAnswer: "3",
        explanation: "Add 9 to both sides: $3x = 9$. Divide by 3: $x = 3$.",
        topicId: linearEqTopic.id,
        status: "PUBLISHED",
      },
    });

    const q3 = await prisma.question.create({
      data: {
        stem: "A line passes through $(0, 4)$ and $(2, 0)$. Which equation represents this line?",
        type: "MC",
        difficulty: "EASY",
        correctAnswer: "B",
        explanation: "Slope $= (0-4)/(2-0) = -2$. Using point $(0,4)$: $y = -2x + 4$.",
        topicId: linearEqTopic.id,
        status: "PUBLISHED",
        options: {
          create: [
            { label: "A", text: "$y = 2x + 4$" },
            { label: "B", text: "$y = -2x + 4$" },
            { label: "C", text: "$y = -2x - 4$" },
            { label: "D", text: "$y = 2x - 4$" },
          ],
        },
      },
    });

    const q4 = await prisma.question.create({
      data: {
        stem: "The equation $4x + 2y = 16$ can be written in slope-intercept form as which of the following?",
        type: "MC",
        difficulty: "MEDIUM",
        correctAnswer: "A",
        explanation: "Isolate $y$: $2y = -4x + 16$, so $y = -2x + 8$.",
        topicId: linearEqTopic.id,
        status: "PUBLISHED",
        options: {
          create: [
            { label: "A", text: "$y = -2x + 8$" },
            { label: "B", text: "$y = 2x + 8$" },
            { label: "C", text: "$y = -2x - 8$" },
            { label: "D", text: "$y = 4x + 8$" },
          ],
        },
      },
    });

    const q5 = await prisma.question.create({
      data: {
        stem: "If $5(x - 2) = 3x + 4$, what is $x$?",
        type: "NUMERIC",
        difficulty: "MEDIUM",
        correctAnswer: "7",
        explanation: "Expand: $5x - 10 = 3x + 4$. Subtract $3x$: $2x - 10 = 4$. Add 10: $2x = 14$, $x = 7$.",
        topicId: linearEqTopic.id,
        status: "PUBLISHED",
      },
    });

    // Practice Set Easy #1
    const ps1 = await prisma.practiceSet.create({
      data: {
        name: "Linear Equations — Easy #1",
        topicId: linearEqTopic.id,
        difficulty: "EASY",
        status: "PUBLISHED",
        explanationVisibility: "AFTER_FINISH",
        questions: {
          create: [
            { questionId: q1.id, order: 1 },
            { questionId: q2.id, order: 2 },
            { questionId: q3.id, order: 3 },
          ],
        },
      },
    });

    // Practice Set Medium #1
    const ps2 = await prisma.practiceSet.create({
      data: {
        name: "Linear Equations — Medium #1",
        topicId: linearEqTopic.id,
        difficulty: "MEDIUM",
        status: "PUBLISHED",
        explanationVisibility: "HIDDEN",
        questions: {
          create: [
            { questionId: q4.id, order: 1 },
            { questionId: q5.id, order: 2 },
          ],
        },
      },
    });

    // Assign ps1 to students[0] and students[1]
    await prisma.assignment.create({
      data: {
        practiceSetId: ps1.id,
        studentId: students[0].id,
        assignedById: teacher.id,
        dueDate: new Date("2026-06-15"),
        status: "PENDING",
        locked: false,
      },
    });

    await prisma.assignment.create({
      data: {
        practiceSetId: ps1.id,
        studentId: students[1].id,
        assignedById: teacher.id,
        status: "PENDING",
        locked: false,
      },
    });

    await prisma.assignment.create({
      data: {
        practiceSetId: ps2.id,
        studentId: students[0].id,
        assignedById: teacher.id,
        status: "PENDING",
        locked: true,
      },
    });
  }

  console.log("✅ Seed complete");
  console.log("Admin: admin@sat.com / admin123");
  console.log("Teacher: teacher@sat.com / teacher123");
  console.log("Students: student1@sat.com ... student4@sat.com / student123");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
