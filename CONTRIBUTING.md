# Contributing to AmarBin Backend

Thank you for your interest in contributing to AmarBin! This document provides guidelines and information for contributors.

## 🤝 Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. Please be respectful and constructive in all interactions.

## 🚀 Getting Started

### Prerequisites
- Node.js 18.0+
- MongoDB 6.0+
- Git
- Basic knowledge of JavaScript, Express.js, and MongoDB

### Development Setup

1. **Fork the repository**
   ```bash
   # Click the "Fork" button on GitHub
   ```

2. **Clone your fork**
   ```bash
   git clone https://github.com/yourusername/amarbin-backend.git
   cd amarbin-backend
   ```

3. **Add upstream remote**
   ```bash
   git remote add upstream https://github.com/originalowner/amarbin-backend.git
   ```

4. **Install dependencies**
   ```bash
   npm install
   ```

5. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env with your local configuration
   ```

6. **Start development server**
   ```bash
   npm run dev
   ```

## 📝 Development Workflow

### Branch Naming Convention

Use descriptive branch names with prefixes:

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Adding tests
- `chore/` - Maintenance tasks

Examples:
```bash
feature/user-profile-management
fix/authentication-token-expiry
docs/api-documentation-update
refactor/database-connection-pooling
```

### Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

#### Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `perf`: Performance improvements
- `ci`: CI/CD changes

#### Examples:
```bash
feat(auth): add JWT refresh token functionality
fix(validation): resolve email validation regex issue
docs(readme): update installation instructions
refactor(database): optimize connection pooling
test(auth): add unit tests for login endpoint
```

### Pull Request Process

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write clean, readable code
   - Follow existing code style
   - Add tests for new functionality
   - Update documentation as needed

3. **Test your changes**
   ```bash
   npm test
   npm run lint
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

5. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create Pull Request**
   - Go to GitHub and create a PR
   - Use the PR template
   - Link related issues
   - Request review from maintainers

## 🧪 Testing Guidelines

### Running Tests
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- auth.test.js
```

### Writing Tests
- Write unit tests for all new functions
- Write integration tests for API endpoints
- Aim for >80% code coverage
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)

Example test structure:
```javascript
describe('Authentication', () => {
  describe('POST /api/auth/login', () => {
    it('should return JWT token for valid credentials', async () => {
      // Arrange
      const userData = { email: 'test@example.com', password: 'password123' };
      
      // Act
      const response = await request(app)
        .post('/api/auth/login')
        .send(userData);
      
      // Assert
      expect(response.status).toBe(200);
      expect(response.body.data.tokens.accessToken).toBeDefined();
    });
  });
});
```

## 📋 Code Style Guidelines

### JavaScript Style
- Use ES6+ features
- Use `const` and `let` instead of `var`
- Use arrow functions for callbacks
- Use template literals for string interpolation
- Use destructuring when appropriate
- Use async/await instead of callbacks

### Code Organization
- Keep functions small and focused
- Use meaningful variable and function names
- Add comments for complex logic
- Follow DRY (Don't Repeat Yourself) principle
- Use proper error handling

### File Structure
```
src/
├── config/           # Configuration files
├── middleware/       # Express middleware
├── models/          # Database models
├── routes/          # API routes
├── utils/           # Utility functions
├── tests/           # Test files
└── server.js        # Main application file
```

## 🔒 Security Guidelines

### Security Best Practices
- Never commit sensitive data (passwords, API keys, etc.)
- Use environment variables for configuration
- Validate all input data
- Sanitize user inputs
- Use parameterized queries
- Implement proper authentication and authorization
- Follow OWASP security guidelines

### Reporting Security Issues
If you discover a security vulnerability, please:
1. **DO NOT** create a public issue
2. Email security@amarbin.com with details
3. Allow time for the issue to be addressed
4. Follow responsible disclosure practices

## 📚 Documentation

### Code Documentation
- Add JSDoc comments for functions and classes
- Document complex algorithms and business logic
- Keep README.md updated
- Update API documentation for new endpoints

### API Documentation
- Use Swagger/OpenAPI for API documentation
- Include request/response examples
- Document all parameters and responses
- Update documentation with code changes

## 🐛 Bug Reports

### Before Submitting
- Check existing issues to avoid duplicates
- Test with the latest version
- Gather relevant information

### Bug Report Template
```markdown
**Bug Description**
A clear description of the bug.

**Steps to Reproduce**
1. Step one
2. Step two
3. Step three

**Expected Behavior**
What should happen.

**Actual Behavior**
What actually happens.

**Environment**
- OS: [e.g., Windows 10, macOS 12.0]
- Node.js version: [e.g., 18.17.0]
- MongoDB version: [e.g., 6.0.8]

**Additional Context**
Any other relevant information.
```

## 💡 Feature Requests

### Feature Request Template
```markdown
**Feature Description**
A clear description of the feature.

**Use Case**
Why is this feature needed?

**Proposed Solution**
How should this feature work?

**Alternatives Considered**
Other solutions you've considered.

**Additional Context**
Any other relevant information.
```

## 🎯 Development Tips

### Performance
- Use database indexes appropriately
- Implement caching where beneficial
- Optimize database queries
- Monitor memory usage
- Use connection pooling

### Error Handling
- Use try-catch blocks for async operations
- Provide meaningful error messages
- Log errors appropriately
- Handle edge cases

### Code Quality
- Run linter before committing
- Write self-documenting code
- Use consistent naming conventions
- Keep functions pure when possible

## 📞 Getting Help

- **Documentation**: Check the README and API docs first
- **Issues**: Search existing GitHub issues
- **Discussions**: Use GitHub Discussions for questions
- **Email**: Contact maintainers at dev@amarbin.com

## 🏆 Recognition

Contributors will be recognized in:
- CONTRIBUTORS.md file
- Release notes
- Project documentation

Thank you for contributing to AmarBin! 🙏
