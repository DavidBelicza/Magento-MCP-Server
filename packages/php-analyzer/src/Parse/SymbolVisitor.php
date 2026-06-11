<?php

declare(strict_types=1);

namespace Magentic\PhpAnalyzer\Parse;

use PhpParser\Node;
use PhpParser\NodeVisitorAbstract;

class SymbolVisitor extends NodeVisitorAbstract
{
    /** @var array<int, Fact> */
    private array $facts = [];

    private string $namespace = '';

    /** @var array<string, string> */
    private array $uses = [];

    public function __construct(private DocBlockTypeResolver $docBlockResolver)
    {
    }

    public function enterNode(Node $node): null
    {
        match (true) {
            $node instanceof Node\Stmt\Namespace_ => $this->enterNamespace($node),
            $node instanceof Node\Stmt\Use_ => $this->collectUses($node->uses, ''),
            $node instanceof Node\Stmt\GroupUse => $this->collectUses($node->uses, $node->prefix->toString()),
            $node instanceof Node\Stmt\Class_ => $this->handleClass($node),
            $node instanceof Node\Stmt\Interface_ => $this->handleInterface($node),
            $node instanceof Node\Stmt\Trait_ => $this->handleTrait($node),
            $node instanceof Node\Stmt\Enum_ => $this->handleEnum($node),
            default => null,
        };

        return null;
    }

    private function enterNamespace(Node\Stmt\Namespace_ $namespace): void
    {
        $this->namespace = $namespace->name?->toString() ?? '';
        $this->uses = [];
    }

    /**
     * @param array<int, Node\UseItem> $uses
     */
    private function collectUses(array $uses, string $prefix): void
    {
        foreach ($uses as $use) {
            $name = $prefix === '' ? $use->name->toString() : $prefix . '\\' . $use->name->toString();
            $this->uses[strtolower($use->getAlias()->toString())] = $name;
        }
    }

    /**
     * @return array<int, Fact>
     */
    public function facts(): array
    {
        return $this->facts;
    }

    private function handleClass(Node\Stmt\Class_ $class): void
    {
        $fqcn = $this->fqcn($class);
        if ($fqcn === null) {
            return;
        }

        $symbolId = SymbolKind::Class_->idFor($fqcn);
        $parentFqcn = $class->extends instanceof Node\Name ? $class->extends->toString() : null;

        $this->facts[] = Fact::symbol($symbolId, $fqcn, SymbolKind::Class_->value, true, [
            'abstract' => $class->isAbstract(),
            'final' => $class->isFinal(),
            'readonly' => $class->isReadonly(),
        ]);

        if ($parentFqcn !== null) {
            $parentId = SymbolKind::Class_->idFor($parentFqcn);
            $this->facts[] = Fact::symbol($parentId, $parentFqcn, SymbolKind::Class_->value, false);
            $this->facts[] = Fact::reference(ReferenceKind::Extends, $symbolId, $parentId);
        }

        foreach ($class->implements as $interface) {
            $this->addImplements($symbolId, $interface);
        }

        $this->addTraitUses($symbolId, $class);
        $this->addMethods($fqcn, $symbolId, $class, $parentFqcn);
    }

    private function handleInterface(Node\Stmt\Interface_ $interface): void
    {
        $fqcn = $this->fqcn($interface);
        if ($fqcn === null) {
            return;
        }

        $symbolId = SymbolKind::Interface_->idFor($fqcn);
        $this->facts[] = Fact::symbol($symbolId, $fqcn, SymbolKind::Interface_->value, true);

        foreach ($interface->extends as $parent) {
            $parentFqcn = $parent->toString();
            $parentId = SymbolKind::Interface_->idFor($parentFqcn);
            $this->facts[] = Fact::symbol($parentId, $parentFqcn, SymbolKind::Interface_->value, false);
            $this->facts[] = Fact::reference(ReferenceKind::Extends, $symbolId, $parentId);
        }

        $this->addMethods($fqcn, $symbolId, $interface, null);
    }

    private function handleTrait(Node\Stmt\Trait_ $trait): void
    {
        $fqcn = $this->fqcn($trait);
        if ($fqcn === null) {
            return;
        }

        $symbolId = SymbolKind::Trait_->idFor($fqcn);
        $this->facts[] = Fact::symbol($symbolId, $fqcn, SymbolKind::Trait_->value, true);

        $this->addTraitUses($symbolId, $trait);
        $this->addMethods($fqcn, $symbolId, $trait, null);
    }

    private function handleEnum(Node\Stmt\Enum_ $enum): void
    {
        $fqcn = $this->fqcn($enum);
        if ($fqcn === null) {
            return;
        }

        $symbolId = SymbolKind::Enum_->idFor($fqcn);
        $this->facts[] = Fact::symbol($symbolId, $fqcn, SymbolKind::Enum_->value, true);

        foreach ($enum->implements as $interface) {
            $this->addImplements($symbolId, $interface);
        }

        $this->addTraitUses($symbolId, $enum);
        $this->addMethods($fqcn, $symbolId, $enum, null);
    }

    private function addImplements(string $fromSymbolId, Node\Name $interface): void
    {
        $interfaceFqcn = $interface->toString();
        $interfaceId = SymbolKind::Interface_->idFor($interfaceFqcn);
        $this->facts[] = Fact::symbol($interfaceId, $interfaceFqcn, SymbolKind::Interface_->value, false);
        $this->facts[] = Fact::reference(ReferenceKind::Implements, $fromSymbolId, $interfaceId);
    }

    private function addTraitUses(string $fromSymbolId, Node\Stmt\ClassLike $classLike): void
    {
        foreach ($classLike->getTraitUses() as $traitUse) {
            foreach ($traitUse->traits as $trait) {
                $traitFqcn = $trait->toString();
                $traitId = SymbolKind::Trait_->idFor($traitFqcn);
                $this->facts[] = Fact::symbol($traitId, $traitFqcn, SymbolKind::Trait_->value, false);
                $this->facts[] = Fact::reference(ReferenceKind::Uses, $fromSymbolId, $traitId);
            }
        }
    }

    private function addMethods(
        string $ownerFqcn,
        string $ownerSymbolId,
        Node\Stmt\ClassLike $classLike,
        ?string $parentFqcn
    ): void {
        $typeRenderer = new TypeRenderer($ownerFqcn, $parentFqcn);
        $scope = new DocBlockScope($this->namespace, $this->uses, $ownerFqcn, $parentFqcn);

        foreach ($classLike->getMethods() as $method) {
            $methodFqcn = $ownerFqcn . '::' . $method->name->toString();
            $methodId = SymbolKind::Method->idFor($methodFqcn);
            $properties = $this->methodProperties($method, $typeRenderer, $scope);

            $this->facts[] = Fact::symbol($methodId, $methodFqcn, SymbolKind::Method->value, true, $properties);
            $this->facts[] = Fact::reference(ReferenceKind::HasMethod, $ownerSymbolId, $methodId);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function methodProperties(
        Node\Stmt\ClassMethod $method,
        TypeRenderer $typeRenderer,
        DocBlockScope $scope
    ): array {
        $docComment = $method->getDocComment()?->getText() ?? '';
        $docTypes = $docComment === '' ? new MethodDocTypes('', []) : $this->docBlockResolver->resolve($docComment, $scope);

        $returnType = $typeRenderer->render($method->returnType);

        $paramNames = [];
        $paramTypes = [];
        $paramTypesDoc = [];
        $parameters = [];

        foreach ($method->params as $param) {
            if (!$param->var instanceof Node\Expr\Variable || !is_string($param->var->name)) {
                continue;
            }

            $name = $param->var->name;
            $type = $typeRenderer->render($param->type);
            $docType = $docTypes->paramTypes[$name] ?? '';

            $paramNames[] = $name;
            $paramTypes[] = $type;
            $paramTypesDoc[] = $docType === $type ? '' : $docType;
            $parameters[] = [
                'optional' => $param->default !== null,
                'variadic' => $param->variadic,
                'byRef' => $param->byRef,
                'promoted' => $param->flags !== 0,
            ];
        }

        return [
            'name' => $method->name->toString(),
            'visibility' => $this->visibility($method),
            'static' => $method->isStatic(),
            'abstract' => $method->isAbstract(),
            'final' => $method->isFinal(),
            'hasBody' => $method->stmts !== null,
            'returnType' => $returnType,
            'returnTypeDoc' => $docTypes->returnType === $returnType ? '' : $docTypes->returnType,
            'paramNames' => $paramNames,
            'paramTypes' => $paramTypes,
            'paramTypesDoc' => $paramTypesDoc,
            'parameters' => $parameters,
        ];
    }

    private function visibility(Node\Stmt\ClassMethod $method): string
    {
        return match (true) {
            $method->isPrivate() => 'private',
            $method->isProtected() => 'protected',
            default => 'public',
        };
    }

    private function fqcn(Node\Stmt\ClassLike $classLike): ?string
    {
        return $classLike->namespacedName?->toString();
    }
}
