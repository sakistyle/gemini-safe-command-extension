# Contributing to Gemini Safe Command Extension

Thank you for your interest in improving the Gemini Safe Command Extension! To maintain the quality and security of this project, we follow a specific contribution workflow.

## Branching Strategy

- **`main`**: The stable production branch. Code here is always release-ready.
- **`develop`**: The integration branch for new features and bug fixes.
- **Feature Branches**: Create a new branch for each task from `develop`. Use a naming convention like `feature/xxx`, `fix/xxx`, or `docs/xxx`.

## How to Contribute

1.  **Fork the repository** and create your branch from `develop`.
2.  **Setup your development environment**:
    ```bash
    npm install
    ```
3.  **Make your changes**: Ensure your code adheres to the project's style and security guidelines.
4.  **Write Tests**: If you add a new feature or fix a bug, please add corresponding tests in the `tests/` directory.
5.  **Run Tests**:
    ```bash
    npm test
    ```
    Ensure all tests pass before submitting.
6.  **Submit a Pull Request**: Target the **`develop`** branch of this repository.

## Pull Request Guidelines

- Provide a clear description of the changes and why they are needed.
- Link any related issues.
- Every PR requires a review and "Passing" tests status.
- For critical security changes, an additional review from a security expert is recommended.

## Coding Standards

- We use TypeScript.
- Follow existing patterns for command validation.
- Keep comments in English for global accessibility.

## License

By contributing, you agree that your contributions will be licensed under the project's **MIT License**.
