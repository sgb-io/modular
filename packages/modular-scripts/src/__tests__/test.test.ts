import execa, { ExecaError } from 'execa';
import path from 'path';
import fs from 'fs-extra';
import tmp from 'tmp';
import {
  createModularTestContext,
  runYarnModular,
  runModularPipeLogs,
} from '../test/utils';
import getModularRoot from '../utils/getModularRoot';

const modularRoot = getModularRoot();

describe('Modular test command', () => {
  describe('test command succeeds on valid test and fails on invalid tests', () => {
    let tempModularRepo: string;

    beforeEach(() => {
      tempModularRepo = createModularTestContext();
      const fixturesFolder = path.join(__dirname, '__fixtures__', 'test');
      const relativeFixturePath = fixturesFolder.replace(modularRoot, '');
      const tempFixturesFolder = path.join(
        tempModularRepo,
        relativeFixturePath,
      );
      fs.mkdirsSync(tempFixturesFolder);
      const files = fs.readdirSync(path.join(fixturesFolder));
      files.forEach((file) => {
        fs.writeFileSync(
          path.join(tempFixturesFolder, file),
          fs
            .readFileSync(path.join(fixturesFolder, file), 'utf-8')
            .replace('describe.skip', 'describe'),
        );
      });
    });

    describe('when the tests fail', () => {
      it('should exit with an error', async () => {
        let errorNumber = 0;
        try {
          await runYarnModular(
            tempModularRepo,
            'test --regex test/InvalidTest.test.ts --watchAll=false',
          );
        } catch (error) {
          errorNumber = (error as ExecaError).exitCode;
        }
        expect(errorNumber).toBe(1);
      });
    });

    describe('when the tests pass', () => {
      it('should exit with no error', async () => {
        let errorNumber = 0;
        try {
          await runYarnModular(
            tempModularRepo,
            'test --regex test/ValidTest.test.ts --watchAll=false',
          );
        } catch (error) {
          errorNumber = (error as ExecaError).exitCode;
        }
        expect(errorNumber).toBe(0);
      });
    });
  });

  describe('test command can successfully do selective tests based on the state of the repository', () => {
    const fixturesFolder = path.join(
      __dirname,
      Array.from({ length: 4 }).reduce<string>(
        (acc) => `${acc}..${path.sep}`,
        '',
      ),
      '__fixtures__',
      'ghost-testing',
    );

    let randomOutputFolder: string;

    beforeEach(() => {
      // Create random dir
      randomOutputFolder = tmp.dirSync({ unsafeCleanup: true }).name;
      fs.copySync(fixturesFolder, randomOutputFolder);

      // Create git repo & commit
      if (process.env.GIT_AUTHOR_NAME && process.env.GIT_AUTHOR_EMAIL) {
        execa.sync('git', [
          'config',
          '--global',
          'user.email',
          `"${process.env.GIT_AUTHOR_EMAIL}"`,
        ]);
        execa.sync('git', [
          'config',
          '--global',
          'user.name',
          `"${process.env.GIT_AUTHOR_NAME}"`,
        ]);
      }
      execa.sync('git', ['init'], {
        cwd: randomOutputFolder,
      });
      execa.sync('yarn', {
        cwd: randomOutputFolder,
      });
      execa.sync('git', ['add', '.'], {
        cwd: randomOutputFolder,
      });
      execa.sync('git', ['commit', '-am', '"First commit"'], {
        cwd: randomOutputFolder,
      });
    });

    // These expects run in a single test, serially for performance reasons (the setup time is quite long)
    it('finds no unchanged using --changed / finds changed after modifying some workspaces / finds ancestors using --ancestors', () => {
      const resultUnchanged = runModularPipeLogs(
        randomOutputFolder,
        'test --changed',
        'true',
      );
      expect(resultUnchanged.stdout).toContain(
        'No workspaces found in selection',
      );

      fs.appendFileSync(
        path.join(randomOutputFolder, '/packages/b/src/index.ts'),
        "\n// Comment to package b's source",
      );
      fs.appendFileSync(
        path.join(randomOutputFolder, '/packages/c/src/index.ts'),
        "\n// Comment to package c's source",
      );

      const resultChanged = runModularPipeLogs(
        randomOutputFolder,
        'test --changed',
        'true',
      );
      expect(resultChanged.stderr).toContain('c-nested.test.ts');
      expect(resultChanged.stderr).toContain('c.test.ts');
      expect(resultChanged.stderr).toContain('b-nested.test.ts');
      expect(resultChanged.stderr).toContain('b.test.ts');

      const resultChangedWithAncestors = runModularPipeLogs(
        randomOutputFolder,
        'test --changed --ancestors',
      );
      expect(resultChangedWithAncestors.stderr).toContain('c-nested.test.ts');
      expect(resultChangedWithAncestors.stderr).toContain('c.test.ts');
      expect(resultChangedWithAncestors.stderr).toContain('b-nested.test.ts');
      expect(resultChangedWithAncestors.stderr).toContain('b.test.ts');
      expect(resultChangedWithAncestors.stderr).toContain('a-nested.test.ts');
      expect(resultChangedWithAncestors.stderr).toContain('a.test.ts');
      expect(resultChangedWithAncestors.stderr).toContain('e-nested.test.ts');
      expect(resultChangedWithAncestors.stderr).toContain('e.test.ts');
    });
  });

  describe('test command can successfully do selective tests based on selected packages', () => {
    const fixturesFolder = path.join(
      __dirname,
      Array.from({ length: 4 }).reduce<string>(
        (acc) => `${acc}..${path.sep}`,
        '',
      ),
      '__fixtures__',
      'ghost-testing',
    );

    let randomOutputFolder: string;

    beforeEach(() => {
      // Create random dir
      randomOutputFolder = createModularTestContext();
      fs.copySync(fixturesFolder, randomOutputFolder);
      execa.sync('yarn', {
        cwd: randomOutputFolder,
      });
    });

    // Run in a single test, serially for performance reasons (the setup time is quite long)
    it('finds test after specifying a valid package / finds ancestors using --ancestors', () => {
      const resultPackages = runModularPipeLogs(
        randomOutputFolder,
        'test b c',
        'true',
      );
      expect(resultPackages.stderr).toContain('c-nested.test.ts');
      expect(resultPackages.stderr).toContain('c.test.ts');
      expect(resultPackages.stderr).toContain('b-nested.test.ts');
      expect(resultPackages.stderr).toContain('b.test.ts');

      const resultPackagesWithAncestors = runModularPipeLogs(
        randomOutputFolder,
        'test b c --ancestors',
        'true',
      );
      expect(resultPackagesWithAncestors.stderr).toContain('c-nested.test.ts');
      expect(resultPackagesWithAncestors.stderr).toContain('c.test.ts');
      expect(resultPackagesWithAncestors.stderr).toContain('b-nested.test.ts');
      expect(resultPackagesWithAncestors.stderr).toContain('b.test.ts');
      expect(resultPackagesWithAncestors.stderr).toContain('a-nested.test.ts');
      expect(resultPackagesWithAncestors.stderr).toContain('a.test.ts');
      expect(resultPackagesWithAncestors.stderr).toContain('e-nested.test.ts');
      expect(resultPackagesWithAncestors.stderr).toContain('e.test.ts');

      const resultPackagesWithDescendants = runModularPipeLogs(
        randomOutputFolder,
        'test b c --descendants',
        'true',
      );
      expect(resultPackagesWithDescendants.stderr).toContain(
        'c-nested.test.ts',
      );
      expect(resultPackagesWithDescendants.stderr).toContain('c.test.ts');
      expect(resultPackagesWithDescendants.stderr).toContain(
        'd-nested.test.ts',
      );
      expect(resultPackagesWithDescendants.stderr).toContain('d.test.ts');
      expect(resultPackagesWithDescendants.stderr).toContain(
        'b-nested.test.ts',
      );

      const resultPackagesWithMixedRegex = runModularPipeLogs(
        randomOutputFolder,
        'test b c --descendants --regex a-nested.test.ts',
        'true',
      );
      expect(resultPackagesWithMixedRegex.stderr).toContain('c-nested.test.ts');
      expect(resultPackagesWithMixedRegex.stderr).toContain('c.test.ts');
      expect(resultPackagesWithMixedRegex.stderr).toContain('d-nested.test.ts');
      expect(resultPackagesWithMixedRegex.stderr).toContain('d.test.ts');
      expect(resultPackagesWithMixedRegex.stderr).toContain('b-nested.test.ts');
      expect(resultPackagesWithMixedRegex.stderr).toContain('a-nested.test.ts');
      expect(resultPackagesWithMixedRegex.stderr).not.toContain('a.test.ts');
    });
    it('succesfully parses jest options and passes them to jest', () => {
      const resultPackages = runModularPipeLogs(
        randomOutputFolder,
        'test b c --colors --verbose',
        'true',
      );

      expect(resultPackages.stderr).toContain('c-nested.test.ts');
      expect(resultPackages.stderr).toContain('c.test.ts');
      expect(resultPackages.stderr).toContain('b-nested.test.ts');
      expect(resultPackages.stderr).toContain('b.test.ts');
      expect(resultPackages.stdout).toContain('"--colors"');

      const resultOnlyOptions = runModularPipeLogs(
        randomOutputFolder,
        'test --colors --verbose',
        'true',
      );

      expect(resultOnlyOptions.stderr).toContain('a-nested.test.ts');
      expect(resultOnlyOptions.stderr).toContain('a.test.ts');
      expect(resultOnlyOptions.stderr).toContain('b-nested.test.ts');
      expect(resultOnlyOptions.stderr).toContain('b.test.ts');
      expect(resultOnlyOptions.stderr).toContain('c-nested.test.ts');
      expect(resultOnlyOptions.stderr).toContain('c.test.ts');
      expect(resultOnlyOptions.stderr).toContain('d-nested.test.ts');
      expect(resultOnlyOptions.stderr).toContain('d.test.ts');
      expect(resultOnlyOptions.stderr).toContain('e-nested.test.ts');
      expect(resultOnlyOptions.stderr).toContain('e.test.ts');
      expect(resultOnlyOptions.stdout).toContain('"--colors"');
    });
  });

  describe('test command has error states', () => {
    // Run in a single test, serially for performance reasons (the setup time is quite long)

    it('does not error when specifying a non-existing workspace', async () => {
      const capturedResult = await runYarnModular(
        modularRoot,
        'test non-existing',
      );

      expect(capturedResult?.exitCode).toBe(0);
      expect(capturedResult?.stdout).toContain(
        `No workspaces found in selection`,
      );
    });

    it('errors when specifying --compareBranch without --changed', async () => {
      let capturedError;
      try {
        await runYarnModular(modularRoot, 'test --compareBranch main');
      } catch (error) {
        capturedError = error as ExecaError;
      }
      expect(capturedError?.exitCode).toBe(1);
      expect(capturedError?.stderr).toContain(
        `Option --compareBranch doesn't make sense without option --changed`,
      );
    });
  });
});
