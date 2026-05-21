import com.zerobias.buildtools.content.SchemaPrimitives

plugins {
    id("zb.workspace")
}

group = "com.zerobias.content"

// ════════════════════════════════════════════════════════════
// Crosswalk content validator — owned by this repo.
//
// Philosophy (per Chris/Kevin): the dataloader is the source of truth
// for schema rules (UUID format, mapping shape, referenced framework
// element lookup, etc.). Re-validating those here just creates drift
// risk — when the dataloader tightens a rule, the gate gets stale.
//
// Crosswalk's payload shape:
//   package/<vendor>/<suite>/<versionPair>/
//     index.yml      — crosswalk metadata
//     mappings/...    — element-to-element mappings between two frameworks
//   The third segment <versionPair> is a compound key encoding the
//   source version and the target framework, joined by underscores,
//   e.g. v1_csa_aicm_v1 = "<sourceVer> ✕ <targetVendor>_<targetSuite>_<targetVer>".
//   It is kept VERBATIM (underscores preserved) in both the npm name
//   and zerobias.package — the 57/62 majority convention. (Five legacy
//   packages had the npm name's underscores hand-hyphenated; fixed to
//   verbatim during the gradle migration so all 62 agree.)
//
// This validator only enforces things the dataloader CANNOT or DOES NOT
// check:
//
//   1. Filesystem ↔ npm ↔ zerobias-block triangulation:
//        dir              = package/<vendor>/<suite>/<versionPair>/
//        npm name         = @zerobias-org/crosswalk-<vendor>-<suite>-<versionPair>
//        zerobias.package = <vendor>.<suite>.<versionPair>.crosswalk
//      (<versionPair> verbatim — its internal underscores are NOT
//      hyphenated. The npm name's only hyphens are the three segment
//      separators after `crosswalk`.)
//
//   2. Repo-wide unique `id` UUIDs across BOTH index.yml AND every
//      mappings/*.yml file (separate :validateUniqueIds task).
//
// Everything else delegated to the dataloader in testIntegrationDataloader.
// ════════════════════════════════════════════════════════════
extra["contentValidator"] = { proj: org.gradle.api.Project ->
    val projectDir = proj.projectDir
    val tag = "[crosswalk-validator] ${proj.path}"

    require(projectDir.resolve("index.yml").isFile)    { "$tag index.yml missing in ${projectDir.path}" }
    require(projectDir.resolve("package.json").isFile) { "$tag package.json missing in ${projectDir.path}" }
    require(projectDir.resolve(".npmrc").isFile)       { "$tag .npmrc missing in ${projectDir.path}" }

    // ── 1. Filesystem ↔ npm ↔ zerobias-block triangulation ──
    //
    // npm name keeps the directory segments VERBATIM (hyphens and all —
    // npm allows them). zerobias.package is a dot-separated dataloader
    // key whose segments must be hyphen-free (`^[\d_a-z]+$`), so hyphens
    // are normalized — but the normalization differs by position, to
    // mirror the source each segment references:
    //   • vendor / suite  → hyphens STRIPPED (mirrors the parent suite's
    //     code, e.g. suite nist/800-53 → nist.80053; here 800-218 → 800218)
    //   • versionPair     → hyphens → underscores and dots → underscores
    //     (the compound key is underscore-delimited throughout, so an
    //     embedded framework ref like nist_800-171_rev2 → nist_800_171_rev2)
    val versionPair = projectDir.name
    val suite = projectDir.parentFile.name
    val vendor = projectDir.parentFile.parentFile.name
    val pkgVendor = vendor.replace("-", "")
    val pkgSuite = suite.replace("-", "")
    val pkgVersionPair = versionPair.replace(".", "_").replace("-", "_")

    val pkgDoc = SchemaPrimitives.parseJson(projectDir.resolve("package.json"))
    SchemaPrimitives.requirePackageIdentity(
        pkgDoc,
        expectedNpmName = "@zerobias-org/crosswalk-$vendor-$suite-$versionPair",
        expectedZerobiasPackage = "$pkgVendor.$pkgSuite.$pkgVersionPair.crosswalk",
        field = "$tag package.json",
    )
    require(SchemaPrimitives.getPath(pkgDoc, "zerobias.import-artifact") == "crosswalk" ||
            SchemaPrimitives.getPath(pkgDoc, "auditmation.import-artifact") == "crosswalk") {
        "$tag zerobias.import-artifact must be 'crosswalk'"
    }

    proj.logger.lifecycle("$tag: vendor=$vendor suite=$suite versionPair=$versionPair")
}

// ════════════════════════════════════════════════════════════
// :validateUniqueIds — repo-wide cross-cut over all *.yml.
// ════════════════════════════════════════════════════════════
val validateUniqueIds by tasks.registering {
    group = "verification"
    description = "Fail if two crosswalk / mapping YAMLs share the same id UUID"

    val packageDir = layout.projectDirectory.dir("package").asFile
    inputs.files(
        fileTree(packageDir) {
            include("**/*.yml")
            exclude("**/node_modules/**")
        }
    )

    doLast {
        val byId = mutableMapOf<String, MutableList<String>>()
        packageDir.walkTopDown()
            .onEnter { it.name != "node_modules" }
            .filter { it.isFile && it.name.endsWith(".yml") }
            .forEach { f ->
                val doc = try {
                    SchemaPrimitives.parseYaml(f)
                } catch (e: Exception) {
                    logger.warn("[validateUniqueIds] skipping unparseable ${f.relativeTo(rootDir)}: ${e.message}")
                    return@forEach
                }
                val id = (doc["id"] as? String)?.lowercase() ?: return@forEach
                byId.getOrPut(id) { mutableListOf() }.add(f.relativeTo(rootDir).path)
            }

        val collisions = byId.filterValues { it.size > 1 }
        if (collisions.isNotEmpty()) {
            val report = collisions.entries.joinToString("\n") { (id, paths) ->
                "  $id\n    " + paths.joinToString("\n    ")
            }
            throw GradleException("[validateUniqueIds] duplicate crosswalk/mapping ids across the repo:\n$report")
        }
        logger.lifecycle("[validateUniqueIds] ${byId.size} unique ids across ${byId.values.sumOf { it.size }} yaml files")
    }
}

subprojects {
    tasks.matching { it.name == "validateContent" }.configureEach {
        dependsOn(rootProject.tasks.named("validateUniqueIds"))
    }
}

val projectPaths by tasks.registering {
    group = "info"
    description = "Output project-to-directory mappings for tooling (used by zbb CLI)"
    doLast {
        subprojects.filter { it.buildFile.exists() }.forEach { p ->
            println("${p.path}=${p.projectDir.relativeTo(rootDir)}")
        }
    }
}

val changedModules by tasks.registering {
    group = "info"
    description = "List crosswalk packages changed since last version tag"
    doLast {
        val lastTag = try {
            providers.exec { commandLine("git", "describe", "--tags", "--abbrev=0") }
                .standardOutput.asText.get().trim()
        } catch (e: Exception) {
            logger.warn("No version tags found -- listing all crosswalk packages as changed")
            null
        }

        val diffArgs = if (lastTag != null) listOf("git", "diff", "--name-only", lastTag, "HEAD")
                       else listOf("git", "ls-files")

        val result = providers.exec { commandLine(diffArgs) }.standardOutput.asText.get()

        val packageDir = rootDir.resolve("package")
        val changed = mutableSetOf<String>()
        result.lines()
            .filter { it.startsWith("package/") }
            .forEach { line ->
                var dir = rootDir.resolve(line).parentFile
                while (dir != null && dir != packageDir && dir.startsWith(packageDir)) {
                    if (dir.resolve("build.gradle.kts").isFile) {
                        changed.add(dir.relativeTo(packageDir).path)
                        break
                    }
                    dir = dir.parentFile
                }
            }
        changed.forEach { println(it) }
    }
}
